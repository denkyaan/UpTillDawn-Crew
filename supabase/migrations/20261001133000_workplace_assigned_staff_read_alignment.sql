-- Align workplace reads with assigned staff visibility.
-- Staff may read only workplaces explicitly assigned through a non-cancelled,
-- non-declined shift. Responsible and admin scope remain unchanged.
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
    or (
      public.upt_effective_role((select auth.uid()))='staff'
      and exists (
        select 1
        from public.shifts s
        where s.event_id=workplaces.event_id
          and s.workplace_id=workplaces.id
          and s.user_id=(select auth.uid())
          and s.status<>'cancelled'
          and coalesce(s.response_status,'')<>'declined'
      )
    )
  )
);

notify pgrst,'reload schema';
