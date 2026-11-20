-- Main incident: after separating permanent Maker/Owner from Head Admin,
-- the Owner's profiles.role is deliberately 'staff'. The pre-existing
-- upt_effective_role only honored admin_role_modes for operational Admin
-- profiles, so a Maker selecting "Normale app" in Admin mode was redirected
-- into the staff portal even after upt_set_admin_role_mode returned 'admin'.
--
-- Preserve staff profiles and owner isolation. Only the authenticated Owner
-- may read their explicitly selected role mode through this RPC; everyone
-- else retains the existing upt_effective_role behavior and authorization.
create or replace function public.upt_current_effective_role()
returns text
language sql
stable security definer
set search_path='pg_catalog','public','upt_private'
as $$
  select case
    when auth.uid() is null then null
    when upt_private.is_app_owner(auth.uid()) then coalesce(
      (select m.active_role
       from public.admin_role_modes m
       where m.user_id=auth.uid()
         and m.active_role in ('admin','staff','responsible_lead')),
      'admin'
    )
    else public.upt_effective_role(auth.uid())
  end
$$;
