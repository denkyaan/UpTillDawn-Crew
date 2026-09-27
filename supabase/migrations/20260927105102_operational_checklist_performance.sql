create index if not exists operational_checklists_workplace_fk_idx
on public.operational_checklists(workplace_id);

drop policy if exists operational_checklists_read on public.operational_checklists;
create policy operational_checklists_read
on public.operational_checklists
for select
to authenticated
using (
  public.upt_is_approved()
  and (
    public.upt_is_admin((select auth.uid()))
    or (
      public.upt_feature_allowed('tasks',event_id,workplace_id)
      and (
        public.upt_is_responsible(event_id,workplace_id,(select auth.uid()))
        or exists(
          select 1
          from public.upt_current_work_context() ctx
          where ctx.event_id=operational_checklists.event_id
            and ctx.workplace_id=operational_checklists.workplace_id
        )
      )
    )
  )
);
