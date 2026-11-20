-- Inventory reads follow role visibility, not mutation/enabled authorization.
-- Assigned staff can inspect their workplace inventory; write RPC authorization is unchanged.
create or replace function upt_private.inventory_can_view(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
      or (
        public.upt_feature_visible('inventory',p_event,p_workplace)
        and exists(
          select 1
          from public.shifts s
          where s.user_id=(select auth.uid())
            and s.event_id=p_event
            and s.workplace_id=p_workplace
            and s.status<>'cancelled'
            and coalesce(s.response_status,'')<>'declined'
        )
      )
    ),
    false
  );
$$;

revoke all on function upt_private.inventory_can_view(uuid,uuid) from public,anon;
grant execute on function upt_private.inventory_can_view(uuid,uuid) to authenticated;

drop policy if exists inventory_items_read on public.inventory_items;
create policy inventory_items_read on public.inventory_items
for select to authenticated
using (upt_private.inventory_can_view(event_id,workplace_id));

notify pgrst,'reload schema';
