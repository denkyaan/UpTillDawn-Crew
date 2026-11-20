create or replace function public.upt_admin_system_health()
returns table(
  checked_at timestamptz,
  approved_users bigint,
  active_sessions bigint,
  active_breaks bigint,
  open_incidents bigint,
  pending_checkins bigint,
  pending_checkouts bigint,
  enabled_push_subscriptions bigint,
  notifications_24h bigint,
  unread_notifications bigint,
  offline_operations_24h bigint,
  offline_synced_24h bigint,
  offline_pending bigint,
  offline_failed bigint,
  offline_stale bigint,
  recent_audit_24h bigint
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
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
    (select count(*) from public.profiles p where p.approved=true),
    (select count(*) from public.work_sessions ws where ws.ended_at is null),
    (select count(*) from public.break_sessions bs where bs.ended_at is null),
    (select count(*) from public.incidents i where i.status<>'resolved'),
    (select count(*) from public.check_ins ci where ci.status='pending'),
    (select count(*) from public.check_outs co where co.status='pending'),
    (select count(*) from public.push_subscriptions ps where ps.enabled=true),
    (select count(*) from public.crew_notifications n where n.created_at>=now()-interval '24 hours'),
    (select count(*) from public.crew_notifications n where n.read_at is null),
    (select count(*) from public.offline_operation_records o where o.created_at>=now()-interval '24 hours'),
    (select count(*) from public.offline_operation_records o where o.created_at>=now()-interval '24 hours' and o.status='synced'),
    (select count(*) from public.offline_operation_records o where o.status not in ('synced','failed')),
    (select count(*) from public.offline_operation_records o where o.status='failed'),
    (select count(*) from public.offline_operation_records o where o.status not in ('synced','failed') and o.created_at<now()-interval '5 minutes'),
    (select count(*) from public.upt_audit_logs a where a.created_at>=now()-interval '24 hours');
end;
$function$;

revoke all on function public.upt_admin_system_health()
from public,anon;
grant execute on function public.upt_admin_system_health()
to authenticated;
