-- Promotion directory: no direct exposure of portal_role_assignments to other users.
create or replace function public.upt_promotion_directory()
returns table(id uuid, full_name text, profile_photo_url text, portal_label text)
language sql stable security definer
set search_path = ''
as $$
 with actor as (
   select p.id, p.role, (p.role='admin') as is_admin
   from public.profiles p where p.id=(select auth.uid())
     and p.approved and not coalesce(p.account_blocked,false)
 ), permitted as (
   select exists (
     select 1 from public.portal_role_assignments a
     join actor on actor.id=a.user_id
     where a.portal='promotion' and a.approved and a.revoked_at is null
   ) or exists(select 1 from actor where is_admin) as ok
 ), eligible as (
   select p.id,p.full_name,p.profile_photo_url,
     case when a.portal='promotion' then 'promotion' else 'events' end as portal_label
   from public.profiles p
   join public.portal_role_assignments a on a.user_id=p.id
   where p.approved and not coalesce(p.account_blocked,false)
     and a.approved and a.revoked_at is null
     and a.portal in ('promotion','events')
     and (a.portal='promotion' or exists(
       select 1 from actor u where u.role in ('staff','responsible_lead','admin')
     ))
 )
 select e.id,e.full_name,e.profile_photo_url,e.portal_label
 from eligible e cross join permitted k where k.ok
 order by case when e.portal_label='promotion' then 0 else 1 end,e.full_name,e.id;
$$;
revoke all on function public.upt_promotion_directory() from public,anon;
grant execute on function public.upt_promotion_directory() to authenticated;
notify pgrst,'reload schema';
