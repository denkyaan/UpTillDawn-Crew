-- Separate the permanent Maker/Owner system identity from Head Admin, and
-- exclude it from employee, directory, promotion and leadership management.
-- No email address is hard-coded; no new account is created by this migration.

create or replace function public.upt_leadership_assign(p_slot text,p_user uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog' as $$
declare
 v_actor uuid:=auth.uid();
 v_head uuid;
 v_old_user uuid;
 v_old_grant boolean:=false;
 v_has_grant boolean:=false;
 v_new_managed boolean:=false;
begin
 if v_actor is null or p_slot not in ('head','left_hand','right_hand') then
  raise exception 'Invalid leadership request' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('uptilldawn-one-head-leadership'));
 select l.user_id into v_head from public.upt_organization_leadership l where l.slot='head' for update;
 if v_head is null then
   if p_slot<>'head' or not public.upt_is_admin(v_actor)
     or (p_user is distinct from v_actor and not upt_private.is_app_owner(v_actor))
   then raise exception 'The initial Head must claim their own existing Admin account' using errcode='42501'; end if;
 elsif v_actor<>v_head and not upt_private.is_app_owner(v_actor) then
   raise exception 'Only Head Admin may manage the leadership team' using errcode='42501';
 end if;
 if p_slot='head' and p_user is null then
   raise exception 'Transfer Head before removing it' using errcode='22023';
 end if;
 if p_user is not null and upt_private.is_app_owner(p_user) then
   raise exception 'Maker/Owner cannot occupy an operational leadership slot' using errcode='42501';
 end if;
 if p_user is not null and not exists (
   select 1 from public.profiles p where p.id=p_user and p.approved=true
   and not coalesce(p.account_blocked,false)
 ) then raise exception 'Select an approved, active account' using errcode='22023'; end if;
 if p_slot<>'head' and p_user=v_head then
   raise exception 'Head cannot also be a delegate' using errcode='22023'; end if;
 if p_slot='head' and exists (
  select 1 from public.upt_organization_leadership l where l.user_id=p_user and l.slot<>'head'
 ) then raise exception 'Reassign a deputy slot before Head transfer' using errcode='23505'; end if;

 select l.user_id,l.managed_portal_grant into v_old_user,v_old_grant
 from public.upt_organization_leadership l where l.slot=p_slot for update;

 if p_slot='head' then
   insert into public.upt_organization_leadership(slot,user_id,assigned_by)
    values('head',p_user,v_actor)
    on conflict(slot) do update set user_id=excluded.user_id,assigned_by=v_actor,assigned_at=now();
   -- SECURITY DEFINER runs with the same enforced profile audit triggers.
   -- Keep the acting Head an Admin until every other profile is updated.
   update public.profiles set role='admin' where id=p_user and role<>'admin';
   update public.profiles set role='staff'
    where role='admin' and id<>p_user and id<>v_actor;
   if v_actor<>p_user then
     update public.profiles set role='staff' where id=v_actor and role='admin';
   end if;
 else
   if p_user is not null and exists(
    select 1 from public.profiles where id=p_user and role='admin'
   ) then raise exception 'Deputies cannot retain full Admin role' using errcode='22023'; end if;
   if v_old_user is distinct from p_user and v_old_grant then
     update public.portal_role_assignments
     set approved=false,approved_by=null,approved_at=null,revoked_at=now()
     where user_id=v_old_user and portal='administration'
      and role='administrative_staff' and approved=true and revoked_at is null;
   end if;
   if p_user is null then
     delete from public.upt_organization_leadership where slot=p_slot;
   else
     select exists(select 1 from public.portal_role_assignments
       where user_id=p_user and portal='administration'
        and role='administrative_staff' and approved=true and revoked_at is null
     ) into v_has_grant;
     if not v_has_grant then
       perform public.upt_admin_set_portal_role(
         p_user,'administration','administrative_staff','assign_approved'
       );
       v_new_managed:=true;
     end if;
     insert into public.upt_organization_leadership
       (slot,user_id,assigned_by,managed_portal_grant)
     values(p_slot,p_user,v_actor,v_new_managed)
     on conflict(slot) do update
       set user_id=excluded.user_id,assigned_by=excluded.assigned_by,
           assigned_at=now(),
           managed_portal_grant=case
             when public.upt_organization_leadership.user_id=excluded.user_id
             then public.upt_organization_leadership.managed_portal_grant
             else excluded.managed_portal_grant end;
   end if;
 end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'ORGANIZATION_LEADERSHIP_CHANGED','leadership_slot',
   coalesce(p_user,v_old_user,v_actor),
   jsonb_build_object('slot',p_slot,'previous',v_old_user,'assigned',p_user));
 return jsonb_build_object('slot',p_slot,'userId',p_user,'headId',
   (select user_id from public.upt_organization_leadership where slot='head'));
end;
$$;
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
 if p_user is not null and upt_private.is_app_owner(p_user) then
  raise exception 'Maker/Owner is not an assignable personnel role' using errcode='42501';end if;
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
  if v_head is null and p_user<>v_actor and not upt_private.is_app_owner(v_actor) then
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
CREATE OR REPLACE FUNCTION public.upt_admin_personnel_details()
 RETURNS TABLE(id uuid, email text, full_name text, home_address text, phone_number text, date_of_birth date, national_register_number text, iban text, profile_photo_url text, approved boolean, role text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.upt_is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Geen toegang.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.full_name,
    p.home_address,
    p.phone_number,
    p.date_of_birth,
    p.national_register_number,
    p.iban,
    p.profile_photo_url,
    p.approved,
    p.role,
    p.updated_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE NOT upt_private.is_app_owner(p.id)
  ORDER BY p.full_name NULLS LAST, u.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upt_admin_personnel_details_v2()
 RETURNS TABLE(id uuid, email text, full_name text, home_address text, phone_number text, date_of_birth date, national_register_number text, iban text, profile_photo_url text, approved boolean, role text, updated_at timestamp with time zone, account_blocked boolean, blocked_at timestamp with time zone, blocked_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
begin
  if not public.upt_is_admin(auth.uid()) then raise exception 'Geen toegang.'; end if;
  return query
  select p.id,u.email::text,p.full_name,p.home_address,p.phone_number,p.date_of_birth,
         p.national_register_number,p.iban,p.profile_photo_url,p.approved,p.role,p.updated_at,
         p.account_blocked,p.blocked_at,p.blocked_reason
  from public.profiles p left join auth.users u on u.id=p.id
  where not upt_private.is_app_owner(p.id)
  order by p.full_name nulls last,u.email;
end
$function$;

CREATE OR REPLACE FUNCTION public.upt_crew_directory()
 RETURNS TABLE(id uuid, full_name text, phone_number text, profile_photo_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_feature_visible('crew',null,null) then
    raise exception 'Personeel is voor jouw rol niet zichtbaar.';
  end if;

  return query
  select p.id,p.full_name,p.phone_number,p.profile_photo_url
  from public.profiles p
  where p.approved=true and not upt_private.is_app_owner(p.id)
  order by p.full_name nulls last,p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upt_promotion_directory()
 RETURNS TABLE(id uuid, full_name text, profile_photo_url text, portal_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with actor as (
   select p.id,public.upt_is_admin(p.id) as is_admin
   from public.profiles p
   where p.id=(select auth.uid()) and p.approved
     and not coalesce(p.account_blocked,false)
     and (public.upt_is_admin(p.id) or not public.upt_promotion_is_blocked(p.id))
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
     and not upt_private.is_app_owner(p.id)
 )
 select m.id,m.full_name,m.profile_photo_url,m.portal::text
 from members m cross join access x
 where x.promotion_ok and (m.portal='promotion' or x.events_ok)
 order by case when m.portal='promotion' then 0 else 1 end,m.full_name,m.id;
$function$;

CREATE OR REPLACE FUNCTION public.upt_responsible_crew_directory(event_uuid uuid, workplace_uuid uuid)
 RETURNS TABLE(id uuid, full_name text, phone_number text, profile_photo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.phone_number,
    p.profile_photo_url
  FROM public.profiles p
  JOIN public.shifts s
    ON s.user_id = p.id
  WHERE s.event_id = event_uuid
    AND s.workplace_id = workplace_uuid
    AND p.approved = true
    AND NOT upt_private.is_app_owner(p.id)
    AND (
      public.upt_is_admin(auth.uid())
      OR public.upt_is_responsible(
        event_uuid,
        workplace_uuid,
        auth.uid()
      )
    );
$function$;

-- Maker/Owner is an immutable SYSTEM identity, not the operational Head Admin.
-- Repair only identities already established as owner; never guess owners from names.
DELETE FROM public.upt_organization_leadership l
 USING upt_private.app_owners o
 WHERE l.user_id=o.user_id;
DELETE FROM public.upt_personnel_role_slots r
 USING upt_private.app_owners o
 WHERE r.user_id=o.user_id;
UPDATE public.profiles p SET role='staff'
 WHERE p.role='admin' AND EXISTS(
  SELECT 1 FROM upt_private.app_owners o WHERE o.user_id=p.id
 );

