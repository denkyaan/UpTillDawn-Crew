create or replace function public.upt_admin_release_readiness_snapshot()
returns table(
  checked_at timestamptz,
  latest_migration_version text,
  active_sessions bigint,
  active_breaks bigint,
  open_incidents bigint,
  pending_checkins bigint,
  pending_checkouts bigint,
  offline_pending bigint,
  offline_failed bigint,
  offline_stale bigint
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','upt_private','supabase_migrations'
as $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Geen toegang.';
  end if;

  return query
  select
    now(),
    (select max(version)::text from supabase_migrations.schema_migrations),
    (select count(*) from public.work_sessions ws where ws.ended_at is null),
    (select count(*) from public.break_sessions bs where bs.ended_at is null),
    (select count(*) from public.incidents i where i.status<>'resolved'),
    (select count(*) from public.check_ins ci where ci.status='pending'),
    (select count(*) from public.check_outs co where co.status='pending'),
    (select count(*) from public.offline_operation_records o where o.status not in ('synced','failed')),
    (select count(*) from public.offline_operation_records o where o.status='failed'),
    (select count(*) from public.offline_operation_records o where o.status not in ('synced','failed') and o.created_at<now()-interval '5 minutes');
end;
$function$;

revoke all on function public.upt_admin_release_readiness_snapshot()
from public,anon;
grant execute on function public.upt_admin_release_readiness_snapshot()
to authenticated;
