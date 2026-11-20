-- Avoid calling the intentionally non-executable upt_effective_role helper from RLS.
-- Staff visibility is proven by an approved account plus an explicit own shift.
drop policy if exists upt_event_operational_window on public.workplaces;

create policy upt_event_operational_window
on public.workplaces
as restrictive
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or (
      (
        upt_private.is_event_responsible(event_id,(select auth.uid()))
        or public.upt_is_responsible(event_id,id,(select auth.uid()))
      )
      and upt_private.event_operational(event_id)
    )
    or exists (
      select 1
      from public.shifts s
      where s.event_id=workplaces.event_id
        and s.workplace_id=workplaces.id
        and s.user_id=(select auth.uid())
        and s.status<>'cancelled'
        and coalesce(s.response_status,'')<>'declined'
    )
  )
);

notify pgrst,'reload schema';
