create or replace function public.upt_profile_workplace_options()
returns table(id uuid,name text)
language sql
stable
security definer
set search_path='pg_catalog','public'
as $$
  select wc.id,wc.name
  from public.workplace_catalog wc
  where wc.is_active=true
  order by wc.sort_order,wc.name
$$;

revoke all on function public.upt_profile_workplace_options() from public,anon;
grant execute on function public.upt_profile_workplace_options() to authenticated;

notify pgrst,'reload schema';
