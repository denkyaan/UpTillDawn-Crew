
create or replace function upt_private.cleanup_stale_notifications()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_count integer;
begin
  update public.crew_notifications
  set read_at=now()
  where read_at is null
    and kind in ('check_ins','check_outs','break_warning')
    and created_at < now()-interval '24 hours';
  get diagnostics v_count=row_count;
  return v_count;
end
$fn$;

revoke all on function upt_private.cleanup_stale_notifications() from public,anon,authenticated;

create or replace function public.upt_notification_badge_count()
returns integer
language sql
stable
security invoker
set search_path='pg_catalog','public'
as $fn$
  select count(*)::integer
  from public.crew_notifications n
  where n.user_id=auth.uid()
    and n.read_at is null
    and (
      n.kind not in ('check_ins','check_outs','break_warning')
      or n.created_at >= now()-interval '24 hours'
    );
$fn$;

revoke all on function public.upt_notification_badge_count() from public,anon;
grant execute on function public.upt_notification_badge_count() to authenticated;

do $do$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='uptilldawn-stale-notification-cleanup' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule(
    'uptilldawn-stale-notification-cleanup',
    '*/15 * * * *',
    $cron$select upt_private.cleanup_stale_notifications()$cron$
  );
end
$do$;

select upt_private.cleanup_stale_notifications();

notify pgrst,'reload schema';
