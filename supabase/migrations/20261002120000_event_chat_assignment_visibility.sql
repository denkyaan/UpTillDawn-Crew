-- Preserve normal future-event discovery while retaining assigned event metadata for chat for three days after closure.
drop policy if exists events_read on public.events;
create policy events_read on public.events
for select to authenticated
using (
  public.upt_is_admin()
  or (now()<events.start_at and events.status<>'archived')
  or exists (select 1 from public.event_members em where em.event_id=events.id and em.user_id=(select auth.uid()))
  or exists (
    select 1 from public.shifts s
    where s.event_id=events.id and s.user_id=(select auth.uid())
      and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined'
      and now()>=events.start_at and now()<=events.end_at+interval '3 days'
  )
  or exists (
    select 1 from public.responsible_assignments ra
    where ra.event_id=events.id and ra.user_id=(select auth.uid())
      and now()>=events.start_at and now()<=events.end_at+interval '3 days'
  )
);

drop policy if exists upt_event_visibility_window on public.events;
create policy upt_event_visibility_window on public.events
as restrictive for select to authenticated
using (
  public.upt_is_admin()
  or (now()<events.start_at and events.status<>'archived')
  or (
    now()>=events.start_at and now()<=events.end_at+interval '3 days'
    and (
      exists (select 1 from public.event_members em where em.event_id=events.id and em.user_id=(select auth.uid()))
      or exists (select 1 from public.shifts s where s.event_id=events.id and s.user_id=(select auth.uid()) and s.status<>'cancelled' and coalesce(s.response_status,'')<>'declined')
      or exists (select 1 from public.responsible_assignments ra where ra.event_id=events.id and ra.user_id=(select auth.uid()))
    )
  )
);
notify pgrst,'reload schema';
