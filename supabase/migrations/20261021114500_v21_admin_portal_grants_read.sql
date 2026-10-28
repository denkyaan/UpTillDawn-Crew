-- V2.1: permit approved, unblocked legacy administrators to inspect portal grants.
-- Mutations remain inaccessible to authenticated clients.
create policy portal_role_admin_read
on public.portal_role_assignments for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.approved = true
      and p.account_blocked = false
  )
);
