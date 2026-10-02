-- Keep event metadata readable for assigned crew through the three-day chat retention window.
drop policy if exists events_read on public.events;
create policy events_read on public.events
for select to authenticated
using (
  public.upt_is_admin()
  or exists (select 1 from public.event_members em where em.event_id=events.id and em.user_id=(select auth.uid()))
  or exists (
    select 1 from public.shifts s
    where s.event_id=events.id and s.user_id=(select auth.uid())
      and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined'
      and now()<=events.end_at+interval '3 days'
  )
  or exists (
    select 1 from public.responsible_assignments ra
    where ra.event_id=events.id and ra.user_id=(select auth.uid())
      and now()<=events.end_at+interval '3 days'
  )
);
notify pgrst,'reload schema';
