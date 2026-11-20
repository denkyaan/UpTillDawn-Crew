-- Mirrors isolated Main QA migration 20261118095730.
-- Deny blocked accounts at the central RLS approval boundary, even if a
-- stale profile row accidentally retains approved=true.
-- Keep permanent Maker recovery and existing signed user grants intact.
create or replace function public.upt_is_approved()
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'upt_private'
as $$
  select auth.uid() is not null
    and (
      upt_private.is_app_owner(auth.uid())
      or exists(
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.approved = true
          and coalesce(p.account_blocked,false) = false
      )
    );
$$;

revoke all on function public.upt_is_approved() from public, anon;
grant execute on function public.upt_is_approved() to authenticated;
