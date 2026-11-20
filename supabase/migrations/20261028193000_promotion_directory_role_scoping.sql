-- Directory access follows approved portal assignments, not the legacy profile role.
create or replace function public.upt_promotion_directory()
returns table(id uuid, full_name text, profile_photo_url text, portal_label text)
language sql stable security definer
set search_path = ''
as $$
 with actor as (
   select p.id,(p.role='admin') as is_admin
   from public.profiles p
   where p.id=(select auth.uid()) and p.approved
     and not coalesce(p.account_blocked,false)
 ), access as (
   select
     exists(select 1 from actor where is_admin)
       or exists(select 1 from public.portal_role_assignments a
         join actor on actor.id=a.user_id
         where a.portal='promotion' and a.approved and a.revoked_at is null) as promotion_ok,
     exists(select 1 from actor where is_admin)
       or exists(select 1 from public.portal_role_assignments a
         join actor on actor.id=a.user_id
         where a.portal='events' and a.approved and a.revoked_at is null) as events_ok
 ), members as (
   select distinct p.id,p.full_name,p.profile_photo_url,a.portal
   from public.profiles p
   join public.portal_role_assignments a on a.user_id=p.id
   where p.approved and not coalesce(p.account_blocked,false)
     and a.approved and a.revoked_at is null
     and a.portal in ('promotion','events')
 )
 select m.id,m.full_name,m.profile_photo_url,m.portal::text
 from members m cross join access x
 where x.promotion_ok and (m.portal='promotion' or x.events_ok)
 order by case when m.portal='promotion' then 0 else 1 end,m.full_name,m.id;
$$;
revoke all on function public.upt_promotion_directory() from public,anon;
grant execute on function public.upt_promotion_directory() to authenticated;
notify pgrst,'reload schema';
