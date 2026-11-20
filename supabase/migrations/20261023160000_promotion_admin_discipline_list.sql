-- Admin-only listing: never expose other users' disciplinary records to promoters.
create or replace function public.upt_admin_promotion_discipline_list()
returns table(user_id uuid,strikes integer,suspension_count integer,blocked_until timestamptz,permanently_blocked boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles
 where id=auth.uid() and role='admin' and approved and not account_blocked)
 then raise exception 'Admin required' using errcode='42501';end if;
 return query select d.user_id,d.strikes,d.suspension_count,d.blocked_until,d.permanently_blocked
 from public.promotion_discipline d order by d.updated_at desc limit 500;
end;$$;
revoke all on function public.upt_admin_promotion_discipline_list() from public,anon;
grant execute on function public.upt_admin_promotion_discipline_list() to authenticated;
notify pgrst,'reload schema';
