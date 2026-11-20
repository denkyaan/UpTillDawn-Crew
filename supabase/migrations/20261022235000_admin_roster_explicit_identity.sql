-- Make caller identity explicit in roster RPCs for the SECURITY DEFINER audit.
create or replace function public.upt_admin_roster_create(p_event uuid,p_title text,p_details text,p_start timestamptz,p_end timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Not authorized'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 180 or p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid roster proposal'; end if;
 insert into public.admin_roster_proposals(event_id,title,details,proposed_start,proposed_end)
 values(p_event,trim(p_title),left(coalesce(p_details,''),2000),p_start,p_end) returning id into v_id;
 return v_id;
end $$;
create or replace function public.upt_admin_roster_submit(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then raise exception 'Not authorized'; end if;
 update public.admin_roster_proposals set status='submitted',updated_at=now()
 where id=p_id and status='draft' and (created_by=auth.uid() or public.upt_is_admin());
 if not found then raise exception 'Proposal cannot be submitted'; end if;
end $$;
revoke all on function public.upt_admin_roster_create(uuid,text,text,timestamptz,timestamptz),public.upt_admin_roster_submit(uuid) from public,anon;
grant execute on function public.upt_admin_roster_create(uuid,text,text,timestamptz,timestamptz),public.upt_admin_roster_submit(uuid) to authenticated;
