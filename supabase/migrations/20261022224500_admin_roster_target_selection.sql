create or replace function public.upt_admin_roster_target(p_id uuid,p_shift uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.admin_roster_proposals p join public.shifts s on s.id=p_shift and s.event_id=p.event_id where p.id=p_id and p.status='draft' and (p.created_by=auth.uid() or public.upt_is_admin())) then raise exception 'Invalid target shift'; end if;
 update public.admin_roster_proposals set target_shift_id=p_shift,updated_at=now() where id=p_id and status='draft';
end $$;
revoke all on function public.upt_admin_roster_target(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_roster_target(uuid,uuid) to authenticated;
