-- Authenticated callers cannot SELECT profiles directly. Keep profile-state validation
-- inside a narrowly scoped SECURITY DEFINER entitlement lookup.
create or replace function public.upt_my_portal_assignments()
returns table(portal text, role text, approved boolean, revoked_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select a.portal,a.role,a.approved,a.revoked_at
  from public.portal_role_assignments a
  join public.profiles p on p.id=a.user_id
  where a.user_id=(select auth.uid())
    and p.approved=true
    and p.account_blocked=false
$$;
revoke all on function public.upt_my_portal_assignments() from public,anon;
grant execute on function public.upt_my_portal_assignments() to authenticated;
