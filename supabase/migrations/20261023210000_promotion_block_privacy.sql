-- Prevent authenticated promotion users from querying other users' sanction status.
-- Admin access is retained for administrative workflows.
create or replace function public.upt_promotion_is_blocked(p_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501';end if;
 if p_user is distinct from v_actor and not exists(
  select 1 from public.profiles p
  where p.id=v_actor and p.role='admin' and p.approved and not p.account_blocked
 ) then raise exception 'Not authorized' using errcode='42501';end if;
 return exists(
  select 1 from public.promotion_discipline d
  where d.user_id=p_user and (d.permanently_blocked or d.blocked_until>now())
 );
end;$$;
revoke all on function public.upt_promotion_is_blocked(uuid) from public,anon;
grant execute on function public.upt_promotion_is_blocked(uuid) to authenticated;
notify pgrst,'reload schema';
