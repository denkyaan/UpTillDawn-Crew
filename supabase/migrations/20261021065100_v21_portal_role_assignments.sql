-- V2.1 multi-portal entitlements. Additive; legacy profiles.role remains authoritative
-- for existing event workflows until the application migrates to portal roles.
create table if not exists public.portal_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portal text not null check (portal in ('events','promotion','administration')),
  role text not null check (
    (portal='events' and role in ('event_staff','event_responsible','admin'))
    or (portal='promotion' and role in ('promoter','admin'))
    or (portal='administration' and role in ('administrative_staff','admin'))
  ),
  approved boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id,portal,role),
  constraint portal_approval_consistency check (
    (approved=false and approved_at is null and approved_by is null)
    or (approved=true and approved_at is not null and approved_by is not null)
  )
);

create index if not exists portal_role_assignments_user_idx
  on public.portal_role_assignments(user_id,portal)
  where approved and revoked_at is null;

create index if not exists portal_role_assignments_approved_by_idx
  on public.portal_role_assignments(approved_by);

alter table public.portal_role_assignments enable row level security;

-- Deliberately no authenticated INSERT/UPDATE/DELETE policy.
-- Provisioning is reserved for trusted server-side admin workflows.
create policy portal_role_self_read
  on public.portal_role_assignments for select to authenticated
  using (user_id = (select auth.uid()));

-- This function is a security-invoker lookup; no privilege escalation.
create or replace function public.upt_my_portal_assignments()
returns table(portal text, role text, approved boolean, revoked_at timestamptz)
language sql stable security invoker
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
revoke all on public.portal_role_assignments from anon;
grant select on public.portal_role_assignments to authenticated;
