-- Read-only Maker diagnostics. No production writes, no public access to raw audit metadata.
create or replace function public.upt_god_maker_log_snapshot(p_token text,p_limit integer default 50)
returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog'
as $body$
declare v_audit jsonb; v_recovery jsonb; v_errors jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>100 then
  raise exception 'Invalid log limit' using errcode='22023';
 end if;
 if not upt_private.god_session_valid(p_token) then
  raise exception 'Invalid Maker session' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb)
 into v_audit
 from (
  select id, action, entity_type, created_at
  from public.upt_audit_logs
  order by created_at desc limit p_limit
 )a;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.checked_at desc),'[]'::jsonb)
 into v_recovery
 from (
  select id, check_type, status, checked_at
  from public.recovery_checks
  order by checked_at desc limit p_limit
 )r;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb)
 into v_errors
 from (
  select id, error_name, error_message, route, status, ai_severity,
   maker_action_required, reported_count, created_at, updated_at
  from public.user_error_reports
  order by created_at desc limit p_limit
 )e;
 return jsonb_build_object('audit',v_audit,'recovery',v_recovery,'errors',v_errors);
end
$body$;
revoke all on function public.upt_god_maker_log_snapshot(text,integer) from public,anon;
grant execute on function public.upt_god_maker_log_snapshot(text,integer) to authenticated;
