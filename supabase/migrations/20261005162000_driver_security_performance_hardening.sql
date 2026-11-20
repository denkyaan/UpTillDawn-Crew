revoke all on function public.upt_driver_dashboard(uuid) from public,anon;
grant execute on function public.upt_driver_dashboard(uuid) to authenticated;
revoke all on function public.upt_driver_set_trip_status(uuid,text,timestamptz) from public,anon;
grant execute on function public.upt_driver_set_trip_status(uuid,text,timestamptz) to authenticated;
revoke all on function public.upt_driver_time_summary(uuid) from public,anon;
grant execute on function public.upt_driver_time_summary(uuid) to authenticated;
revoke all on function public.upt_is_driver_supervisor(uuid,uuid) from public,anon;
grant execute on function public.upt_is_driver_supervisor(uuid,uuid) to authenticated;

drop policy if exists driver_sessions_read on public.driver_sessions;
create policy driver_sessions_read on public.driver_sessions for select to authenticated using(
 user_id=(select auth.uid()) or public.upt_is_admin((select auth.uid())) or exists(
  select 1 from public.work_sessions ws
  join public.responsible_assignments ra on ra.event_id=ws.event_id
  join public.workplaces rw on rw.id=ra.workplace_id
  where ws.id=driver_sessions.work_session_id and ra.user_id=(select auth.uid()) and lower(rw.name) like '%backstage%'
 )
);
drop policy if exists driver_task_details_select on public.driver_task_details;
create policy driver_task_details_select on public.driver_task_details for select to authenticated using(
 exists(select 1 from public.task_assignments a where a.task_id=driver_task_details.task_id and a.user_id=(select auth.uid()))
 or public.upt_is_admin((select auth.uid()))
);
notify pgrst,'reload schema';