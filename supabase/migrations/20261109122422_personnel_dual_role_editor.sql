-- Exactly two explicit assignable roles per personnel profile.
-- Staff, Responsible, Promotion, Administration and the three leadership slots
-- share one canonical editor; historical accounts are projected on first load.
create table if not exists public.upt_personnel_role_slots (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 role_one text not null check(role_one in ('staff','responsible_lead','promotion','administration','head','left_hand','right_hand')),
 role_two text check(role_two in ('staff','responsible_lead','promotion','administration','head','left_hand','right_hand')),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 constraint upt_role_slots_distinct check(role_two is null or role_two<>role_one)
);
create index if not exists upt_personnel_role_slots_updated_by_idx on public.upt_personnel_role_slots(updated_by);
alter table public.upt_personnel_role_slots enable row level security;
revoke all on public.upt_personnel_role_slots from public,anon,authenticated;
grant select on public.upt_personnel_role_slots to authenticated;
drop policy if exists upt_personnel_role_slots_admin_read on public.upt_personnel_role_slots;
create policy upt_personnel_role_slots_admin_read on public.upt_personnel_role_slots
 for select to authenticated using (public.upt_is_admin() or user_id=(select auth.uid()));

-- This RPC is the only editor. All changes succeed or roll back together.
create or replace function public.upt_admin_set_two_personnel_roles(
 p_user uuid,p_role_one text,p_role_two text,p_confirm_head boolean default false
) returns jsonb language plpgsql security definer set search_path='pg_catalog' as $$
declare
 v_actor uuid:=auth.uid();
 v_head uuid;
 v_existing_head uuid;
 v_old_left uuid;
 v_old_right uuid;
 v_old_user uuid;
 v_portal text;
 v_role text;
 v_want boolean;
 v_current_role text;
 v_slot text;
begin
 if v_actor is null or not public.upt_is_admin(v_actor) or not public.upt_is_approved()
 then raise exception 'Admin approval required' using errcode='42501';end if;
 if p_role_two='none' or p_role_two='' then p_role_two:=null;end if;
 if p_user is null or p_role_one not in
   ('staff','responsible_lead','promotion','administration','head','left_hand','right_hand')
 or (p_role_two is not null and p_role_two not in
   ('staff','responsible_lead','promotion','administration','head','left_hand','right_hand'))
 or p_role_one=p_role_two
 then raise exception 'Invalid two-role selection' using errcode='22023';end if;
 if ('staff'=any(array[p_role_one,p_role_two]) and 'responsible_lead'=any(array[p_role_one,p_role_two]))
 or (select count(*) from unnest(array[p_role_one,p_role_two]) as selected(role)
     where role in ('head','left_hand','right_hand'))>1
 or ('administration'=any(array[p_role_one,p_role_two]) and
    (select count(*) from unnest(array[p_role_one,p_role_two]) as selected(role)
      where role in ('head','left_hand','right_hand'))>0)
 then raise exception 'Conflicting or redundant roles' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('uptilldawn-one-head-leadership'));
 perform 1 from public.profiles where id=p_user and approved and not account_blocked for update;
 if not found then raise exception 'Only approved active personnel can receive roles' using errcode='22023';end if;
 select role into v_current_role from public.profiles where id=p_user;
 select user_id into v_head from public.upt_organization_leadership where slot='head' for update;
 if v_head=p_user and not ('head'=any(array[p_role_one,p_role_two]))
 then raise exception 'Transfer Head Admin before changing their Head role' using errcode='23514';end if;
 if 'head'=any(array[p_role_one,p_role_two]) and v_head is distinct from p_user then
  if not coalesce(p_confirm_head,false) then
   raise exception 'Explicit confirmation required for Head Admin transfer' using errcode='22023';end if;
  if v_head is null and p_user<>v_actor then
   raise exception 'Only the existing Admin may claim Head on their own account' using errcode='42501';end if;
  select user_id into v_old_user from public.upt_organization_leadership where slot='left_hand' and user_id=p_user;
  if v_old_user is not null then perform public.upt_leadership_assign('left_hand',null);end if;
  select user_id into v_old_user from public.upt_organization_leadership where slot='right_hand' and user_id=p_user;
  if v_old_user is not null then perform public.upt_leadership_assign('right_hand',null);end if;
  perform public.upt_leadership_assign('head',p_user);
  if v_head is not null then
   update public.upt_personnel_role_slots
    set role_one=case when role_one='head' then 'staff' else role_one end,
        role_two=case when role_two='head' or (role_one='head' and role_two='staff') then null else role_two end,
        updated_by=v_actor,updated_at=now()
    where user_id=v_head;
  end if;
 end if;

 for v_slot in select unnest(array['left_hand','right_hand']) loop
  select user_id into v_old_user from public.upt_organization_leadership where slot=v_slot;
  v_want=v_slot=any(array[p_role_one,p_role_two]);
  if v_old_user=p_user and not v_want then
   perform public.upt_leadership_assign(v_slot,null);
  elsif v_want and v_old_user is distinct from p_user then
   if v_head is null then raise exception 'Head Admin must be claimed first' using errcode='22023';end if;
   perform public.upt_leadership_assign(v_slot,p_user);
   if v_old_user is not null then
    update public.upt_personnel_role_slots
     set role_one=case when role_one=v_slot then 'staff' else role_one end,
         role_two=case when role_two=v_slot then null else role_two end,
         updated_by=v_actor,updated_at=now()
     where user_id=v_old_user;
   end if;
  end if;
 end loop;

 if 'head'=any(array[p_role_one,p_role_two]) then
   -- Head assignment already promotes its profile to Admin.
   if not exists(select 1 from public.upt_organization_leadership where slot='head' and user_id=p_user)
    then raise exception 'Head assignment did not persist' using errcode='23514';end if;
 elsif v_current_role='admin' and v_head is null then
   -- No legacy Admin loses authority before a confirmed Head claim.
   raise exception 'Claim Head Admin before changing a legacy Admin account' using errcode='23514';
 else
   update public.profiles set role=case when 'responsible_lead'=any(array[p_role_one,p_role_two])
     then 'responsible_lead' else 'staff' end
    where id=p_user and role is distinct from case when 'responsible_lead'=any(array[p_role_one,p_role_two])
     then 'responsible_lead' else 'staff' end;
 end if;

 -- Do not revoke an Administration grant currently owned by a deputy role.
 for v_portal,v_role in
   select * from (values
    ('events','event_staff'),('events','event_responsible'),
    ('promotion','promoter'),('administration','administrative_staff')
   ) as available(portal,role)
 loop
  v_want:=case
    when v_role='event_staff' then 'staff'=any(array[p_role_one,p_role_two])
    when v_role='event_responsible' then 'responsible_lead'=any(array[p_role_one,p_role_two])
    when v_role='promoter' then 'promotion'=any(array[p_role_one,p_role_two])
    else 'administration'=any(array[p_role_one,p_role_two])
      or 'left_hand'=any(array[p_role_one,p_role_two])
      or 'right_hand'=any(array[p_role_one,p_role_two])
  end;
  if v_want then
   insert into public.portal_role_assignments(user_id,portal,role,approved,approved_by,approved_at,revoked_at)
   values(p_user,v_portal,v_role,true,v_actor,now(),null)
   on conflict(user_id,portal,role) do update
    set approved=true,approved_by=v_actor,approved_at=now(),revoked_at=null
   where public.portal_role_assignments.approved=false
      or public.portal_role_assignments.revoked_at is not null;
  else
   update public.portal_role_assignments
    set approved=false,approved_by=null,approved_at=null,revoked_at=now()
    where user_id=p_user and portal=v_portal and role=v_role and revoked_at is null;
  end if;
 end loop;

 insert into public.upt_personnel_role_slots(user_id,role_one,role_two,updated_by)
 values(p_user,p_role_one,p_role_two,v_actor)
 on conflict(user_id) do update set role_one=excluded.role_one,
 role_two=excluded.role_two,updated_by=v_actor,updated_at=now();
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'PERSONNEL_TWO_ROLES_CHANGED','profile',p_user,
  jsonb_build_object('role_one',p_role_one,'role_two',p_role_two));
 return jsonb_build_object('roleOne',p_role_one,'roleTwo',p_role_two);
end;$$;
revoke all on function public.upt_admin_set_two_personnel_roles(uuid,text,text,boolean)
 from public,anon,authenticated;
grant execute on function public.upt_admin_set_two_personnel_roles(uuid,text,text,boolean)
 to authenticated;
comment on function public.upt_admin_set_two_personnel_roles(uuid,text,text,boolean)
 is 'Atomic Head-controlled two-role editor; enforces one Head, exclusive deputy slots, audited promotion/Administration/event roles, and optional second role.';
