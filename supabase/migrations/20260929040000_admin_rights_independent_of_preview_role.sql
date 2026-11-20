create or replace function public.upt_is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    uid is not null
    and (
      upt_private.is_app_owner(uid)
      or exists(
        select 1
        from public.profiles p
        where p.id=uid
          and p.approved=true
          and p.role='admin'
          and coalesce(p.account_blocked,false)=false
      )
    ),
    false
  );
$$;

revoke all on function public.upt_is_admin(uuid) from public,anon;
grant execute on function public.upt_is_admin(uuid) to authenticated;

notify pgrst,'reload schema';
