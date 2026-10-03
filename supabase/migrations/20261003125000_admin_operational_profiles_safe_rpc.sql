-- Keep direct profile reads closed while exposing only the operational fields Admin needs.
create or replace function public.upt_admin_operational_profiles()
returns table(id uuid, full_name text, phone_number text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.upt_is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select p.id,p.full_name,p.phone_number,p.role::text
  from public.profiles p
  where p.approved=true;
end;
$$;

revoke all on function public.upt_admin_operational_profiles() from public, anon;
grant execute on function public.upt_admin_operational_profiles() to authenticated;
