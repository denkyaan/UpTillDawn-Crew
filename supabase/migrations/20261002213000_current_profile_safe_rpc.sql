-- Expose only the authenticated user's non-sensitive session profile fields.
create or replace function public.upt_current_profile()
returns table(id uuid, full_name text, phone_number text, profile_photo_url text, approved boolean, role text, account_blocked boolean)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select p.id,p.full_name,p.phone_number,p.profile_photo_url,p.approved,p.role,p.account_blocked
  from public.profiles p
  where p.id=auth.uid()
$$;
revoke all on function public.upt_current_profile() from public, anon;
grant execute on function public.upt_current_profile() to authenticated;
