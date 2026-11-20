-- Allow approved, unblocked administrators to inspect portal entitlements.
-- Other users retain access only to their own assignments.
drop policy if exists portal_role_admin_read on public.portal_role_assignments;
create policy portal_role_admin_read on public.portal_role_assignments
 for select to authenticated
 using (exists (
   select 1 from public.profiles actor
   where actor.id=(select auth.uid())
     and actor.role='admin'
     and actor.approved=true
     and actor.account_blocked=false
 ));
