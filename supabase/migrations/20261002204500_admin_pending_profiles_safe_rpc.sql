-- Keep sensitive profile columns unavailable to direct authenticated table reads.
revoke select on table public.profiles from authenticated;

create or replace function public.upt_admin_pending_profiles()
returns table(id uuid, full_name text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.upt_is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
  select p.id,p.full_name,p.updated_at
  from public.profiles p
  where p.approved=false
  order by p.updated_at;
end;
$$;

revoke all on function public.upt_admin_pending_profiles() from public, anon;
grant execute on function public.upt_admin_pending_profiles() to authenticated;
