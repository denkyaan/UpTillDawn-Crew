-- Existing core functions aligned to the verified main implementation.
-- Source: main 4538c8ace2b2c2bf6a44a2909104ee0fed76beee; no data/configuration copied.

-- public.upt_apply_operational_checklist_template(p_template uuid, p_event uuid, p_workplace uuid)
CREATE OR REPLACE FUNCTION public.upt_apply_operational_checklist_template(p_template uuid, p_event uuid, p_workplace uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_template public.operational_checklist_templates%rowtype;
  v_workplace public.workplaces%rowtype;
  v_checklist uuid;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  select * into v_template from public.operational_checklist_templates where id=p_template and is_active=true;
  if not found then raise exception 'Checklisttemplate niet gevonden.'; end if;
  select * into v_workplace from public.workplaces where id=p_workplace and event_id=p_event and is_active=true;
  if not found then raise exception 'Werkplek niet gevonden.'; end if;
  if not public.upt_is_admin(v_actor) and not public.upt_is_responsible(p_event,p_workplace,v_actor) then raise exception 'Geen toegang.'; end if;
  if v_template.catalog_workplace_id is not null and v_workplace.catalog_workplace_id is distinct from v_template.catalog_workplace_id then
    raise exception 'Deze template hoort bij een andere werkplek.';
  end if;

  insert into public.operational_checklists(event_id,workplace_id,kind,title,description,status,created_by)
  values(p_event,p_workplace,v_template.kind,v_template.title,v_template.description,'open',v_actor)
  returning id into v_checklist;

  insert into public.checklist_items(checklist_id,label,required,requires_photo,sort_order)
  select v_checklist,label,required,requires_photo,sort_order
  from public.operational_checklist_template_items
  where template_id=p_template order by sort_order,created_at;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'checklist.template.applied','operational_checklist',v_checklist,
    jsonb_build_object('template_id',p_template,'event_id',p_event,'workplace_id',p_workplace));

  return v_checklist;
end;
$function$

-- public.upt_assign_task(p_task uuid, p_user uuid)
CREATE OR REPLACE FUNCTION public.upt_assign_task(p_task uuid, p_user uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task public.tasks%rowtype;
  v_assignment uuid;
  v_admin boolean:=public.upt_is_admin();
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_task from public.tasks where id=p_task;
  if not found then raise exception 'Task not found'; end if;

  if not (
    v_admin
    or (v_task.workplace_id is not null and public.upt_is_responsible(v_task.event_id,v_task.workplace_id,auth.uid()))
  ) then
    raise exception 'Verantwoordelijken kunnen alleen taken beheren binnen hun toegewezen werkplek.';
  end if;

  if not v_admin and not upt_private.event_operational(v_task.event_id) then raise exception 'Evenement is niet meer operationeel.'; end if;
  if not v_admin and not public.upt_feature_allowed('tasks',v_task.event_id,v_task.workplace_id) then raise exception 'Taken zijn op dit moment niet beschikbaar.'; end if;

  if not exists(
    select 1 from public.event_members em
    join public.profiles p on p.id=em.user_id
    where em.event_id=v_task.event_id and em.user_id=p_user and p.approved=true
  ) then raise exception 'User is not an approved member of this event'; end if;

  if not v_admin and not exists(
    select 1 from public.shifts s
    where s.user_id=p_user and s.event_id=v_task.event_id and s.workplace_id=v_task.workplace_id and s.status<>'cancelled'
  ) then raise exception 'Selecteer alleen personeel dat aan jouw werkplek is toegewezen.'; end if;

  insert into public.task_assignments(task_id,user_id,assigned_by,status)
  values(p_task,p_user,auth.uid(),'NOT STARTED')
  on conflict(task_id,user_id) do nothing
  returning id into v_assignment;

  if v_assignment is null then
    select id into v_assignment from public.task_assignments where task_id=p_task and user_id=p_user;
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'TASK_ASSIGNED','task_assignment',v_assignment,jsonb_build_object('task_id',p_task,'user_id',p_user,'workplace_id',v_task.workplace_id));

  return v_assignment;
end;
$function$

-- public.upt_chat_channel_summaries()
CREATE OR REPLACE FUNCTION public.upt_chat_channel_summaries()
 RETURNS TABLE(channel_id uuid, unread_count bigint, mention_count bigint, last_read_at timestamp with time zone, peer_last_read_at timestamp with time zone, mute_mode text, pinned_count bigint, can_pin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'ACCOUNT NOT APPROVED';
  end if;

  insert into upt_private.chat_user_states(channel_id,user_id,last_read_at,mute_mode,updated_at)
  select c.id,v_actor,now(),coalesce(upt_private.chat_default_mute_mode(c.id),'mentions'),now()
  from public.chat_channels c
  where public.upt_can_read_channel(c.id)
  on conflict on constraint chat_user_states_pkey do nothing;

  return query
  select
    c.id,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and m.created_at>coalesce(s.last_read_at,c.created_at)
    )::bigint as unread_count,
    (
      select count(*)
      from public.messages m
      where m.channel_id=c.id
        and m.sender_id is distinct from v_actor
        and m.moderated_at is null
        and v_actor=any(m.mentioned_user_ids)
        and m.created_at>coalesce(s.last_read_at,c.created_at)
    )::bigint as mention_count,
    s.last_read_at,
    case when c.kind='private' and c.name is null then (
      select max(peer_state.last_read_at)
      from public.chat_members peer
      left join upt_private.chat_user_states peer_state
        on peer_state.channel_id=c.id and peer_state.user_id=peer.user_id
      where peer.channel_id=c.id and peer.user_id<>v_actor
    ) else null end,
    s.mute_mode,
    (select count(*) from upt_private.chat_pins pin where pin.channel_id=c.id)::bigint,
    (
      (c.kind in ('event','workplace') and public.upt_is_admin())
      or (c.kind='workplace' and c.event_id is not null and c.workplace_id is not null
          and public.upt_is_responsible(c.event_id,c.workplace_id,v_actor))
      or (c.kind='event' and c.event_id is not null
          and exists(select 1 from public.responsible_assignments ra where ra.event_id=c.event_id and ra.user_id=v_actor))
    ) as can_pin
  from public.chat_channels c
  join upt_private.chat_user_states s on s.channel_id=c.id and s.user_id=v_actor
  where public.upt_can_read_channel(c.id)
  order by c.created_at,c.id;
end;
$function$

-- public.upt_claimable_shifts()
CREATE OR REPLACE FUNCTION public.upt_claimable_shifts()
 RETURNS TABLE(shift_id uuid, event_id uuid, event_name text, workplace_id uuid, workplace_name text, role_name text, shift_kind text, scheduled_start timestamp with time zone, scheduled_end timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
  select
    s.id,
    s.event_id,
    e.name,
    s.workplace_id,
    w.name,
    s.role_name,
    s.shift_kind,
    s.scheduled_start,
    s.scheduled_end
  from public.shifts s
  join public.events e on e.id=s.event_id
  join public.workplaces w on w.id=s.workplace_id
  join public.event_members em on em.event_id=s.event_id and em.user_id=auth.uid()
  where public.upt_is_approved()
    and s.user_id<>auth.uid()
    and s.status<>'cancelled'
    and s.response_status='declined'
    and s.scheduled_start>now()
    and (e.status is null or e.status <> 'archived')
    and upt_private.user_available_for_shift(auth.uid(),s.event_id,s.shift_kind)
    and (
      s.overlap_allowed=true
      or not upt_private.user_has_shift_overlap(
        auth.uid(),s.scheduled_start,s.scheduled_end,s.id,null
      )
    )
    and not exists(
      select 1
      from upt_private.shift_change_requests r
      where r.shift_id=s.id
        and r.requester_id=auth.uid()
        and r.status='pending'
    )
  order by s.scheduled_start
  limit 100;
$function$

-- public.upt_close_event(p_event uuid, p_force boolean, p_reason text)
CREATE OR REPLACE FUNCTION public.upt_close_event(p_event uuid, p_force boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_blockers text[]:=array[]::text[];
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_end timestamptz;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement afsluiten.'; end if;
  select end_at into v_end from public.events where id=p_event;
  if v_end is null then raise exception 'Evenement niet gevonden.'; end if;
  if now()<v_end then v_blockers:=array_append(v_blockers,'evenement is nog niet afgelopen'); end if;
  if exists(select 1 from public.work_sessions ws where ws.event_id=p_event and ws.ended_at is null) then v_blockers:=array_append(v_blockers,'actieve werkuren'); end if;
  if exists(select 1 from public.operational_checklists c where c.event_id=p_event and c.kind='closing' and c.status<>'completed') then v_blockers:=array_append(v_blockers,'onvoltooide sluitchecklists'); end if;
  if exists(select 1 from public.incidents i where i.event_id=p_event and coalesce(i.status,'')<>'resolved' and i.resolved_at is null) then v_blockers:=array_append(v_blockers,'open incidenten'); end if;
  if exists(select 1 from public.inventory_items i where i.event_id=p_event and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0)) then v_blockers:=array_append(v_blockers,'inventory-afwijkingen'); end if;
  if cardinality(v_blockers)>0 and not p_force then raise exception 'Evenement kan nog niet worden afgesloten: %',array_to_string(v_blockers,', '); end if;
  if p_force and cardinality(v_blockers)>0 and (v_reason is null or length(v_reason)<5) then raise exception 'Geef een reden voor geforceerd afsluiten.'; end if;
  update public.events
     set status='closed', end_at=least(end_at,now()), end_date=least(coalesce(end_date,end_at),now()), updated_at=now()
   where id=p_event;
  if not found then raise exception 'Evenement niet gevonden.'; end if;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.closed','event',p_event,jsonb_build_object('forced',p_force,'reason',v_reason,'blockers',v_blockers,'scheduledEnd',v_end,'closedAt',now()));
end;
$function$

-- public.upt_create_assigned_task(p_event uuid, p_workplace uuid, p_user uuid, p_title text, p_description text)
CREATE OR REPLACE FUNCTION public.upt_create_assigned_task(p_event uuid, p_workplace uuid, p_user uuid, p_title text, p_description text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_task uuid;
  v_admin boolean:=public.upt_is_admin();
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  if not (
    v_admin
    or (p_workplace is not null and public.upt_is_responsible(p_event,p_workplace,auth.uid()))
  ) then
    raise exception 'Verantwoordelijken kunnen alleen taken beheren binnen hun toegewezen werkplek.';
  end if;

  if not v_admin and not upt_private.event_operational(p_event) then raise exception 'Evenement is niet meer operationeel.'; end if;
  if not v_admin and not public.upt_feature_allowed('tasks',p_event,p_workplace) then raise exception 'Taken zijn op dit moment niet beschikbaar.'; end if;

  if p_workplace is not null and not exists(
    select 1 from public.workplaces w where w.id=p_workplace and w.event_id=p_event and w.is_active=true
  ) then raise exception 'Werkplek hoort niet bij dit evenement.'; end if;

  if p_title is null or length(trim(p_title)) not between 1 and 200 or length(coalesce(p_description,''))>4000 then
    raise exception 'Invalid task';
  end if;

  if not exists(
    select 1 from public.profiles p
    join public.event_members m on m.user_id=p.id
    where p.id=p_user and p.approved and m.event_id=p_event
  ) then raise exception 'Approved event member required'; end if;

  if not v_admin and not exists(
    select 1 from public.shifts s
    where s.user_id=p_user and s.event_id=p_event and s.workplace_id=p_workplace and s.status<>'cancelled'
  ) then raise exception 'Selecteer alleen personeel dat aan jouw werkplek is toegewezen.'; end if;

  insert into public.tasks(event_id,workplace_id,title,description,created_by)
  values(p_event,p_workplace,trim(p_title),p_description,auth.uid())
  returning id into v_task;

  perform public.upt_assign_task(v_task,p_user);
  return v_task;
end;
$function$

-- public.upt_effective_role(uid uuid)
CREATE OR REPLACE FUNCTION public.upt_effective_role(uid uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when uid is null then null
    when exists (
      select 1 from public.profiles p
      where p.id = uid and p.approved = true and p.role = 'admin'
    ) then coalesce(
      (select m.active_role from public.admin_role_modes m where m.user_id = uid),
      'admin'
    )
    when exists (
      select 1 from public.profiles p
      where p.id = uid and p.approved = true
    ) and exists (
      select 1
      from public.responsible_assignments ra
      join public.events e on e.id = ra.event_id
      where ra.user_id = uid
        and now() >= e.start_at - interval '1 hour'
        and now() <= e.end_at
        and e.status <> 'archived'
    ) then 'responsible_lead'
    when exists (
      select 1 from public.profiles p
      where p.id = uid and p.approved = true
    ) then 'staff'
    else null
  end;
$function$

-- public.upt_notify_task_assignment()
CREATE OR REPLACE FUNCTION public.upt_notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_task public.tasks%rowtype;
begin
 select * into v_task from public.tasks where id=new.task_id;
 insert into public.crew_notifications(user_id,title,body,kind,link)
 values(new.user_id,'Nieuwe taak',v_task.title,'task',case when v_task.promotion_only then '/portals/promotion/tasks' else '/tasks' end);
 return new;
end;
$function$

-- public.upt_responsible_event_members(p_event uuid, p_workplace uuid)
CREATE OR REPLACE FUNCTION public.upt_responsible_event_members(p_event uuid, p_workplace uuid)
 RETURNS TABLE(id uuid, full_name text, phone_number text, profile_photo_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  if p_workplace is not null then
    if not exists(select 1 from public.workplaces w where w.id=p_workplace and w.event_id=p_event) then
      raise exception 'Werkplek niet gevonden.';
    end if;
    if not (public.upt_is_admin(auth.uid()) or public.upt_is_responsible(p_event,p_workplace,auth.uid())) then
      raise exception 'Geen toegang.';
    end if;
    return query
    select distinct p.id,p.full_name,p.phone_number,p.profile_photo_url
    from public.profiles p
    join public.event_members em on em.user_id=p.id and em.event_id=p_event
    join public.shifts s on s.user_id=p.id and s.event_id=p_event and s.workplace_id=p_workplace and s.status<>'cancelled'
    where p.approved=true
    order by p.full_name nulls last,p.id;
  else
    if not (public.upt_is_admin(auth.uid()) or upt_private.is_event_responsible(p_event,auth.uid())) then
      raise exception 'Geen toegang.';
    end if;
    return query
    select distinct p.id,p.full_name,p.phone_number,p.profile_photo_url
    from public.profiles p
    join public.event_members em on em.user_id=p.id
    where em.event_id=p_event and p.approved=true
    order by p.full_name nulls last,p.id;
  end if;
end;
$function$

-- public.upt_staff_workplace_live_status()
CREATE OR REPLACE FUNCTION public.upt_staff_workplace_live_status()
 RETURNS TABLE(session_id uuid, user_id uuid, full_name text, workplace_id uuid, workplace_name text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
  with own_workplaces as (
    select distinct s.event_id,s.workplace_id
    from public.shifts s
    join public.events e on e.id=s.event_id
    where s.user_id=auth.uid()
      and (s.status is null or s.status <> 'cancelled')
      and (s.response_status is null or s.response_status <> 'declined')
      and e.status<>'archived'
      and now() between e.start_at and e.end_at
  ),
  active_sessions as (
    select
      ws.id,
      ws.user_id,
      ws.event_id,
      upt_private.current_session_workplace(ws.id) as workplace_id
    from public.work_sessions ws
    where ws.ended_at is null
  )
  select
    a.id as session_id,
    a.user_id,
    p.full_name,
    a.workplace_id,
    w.name as workplace_name,
    case when exists(
      select 1
      from public.break_sessions bs
      where bs.work_session_id=a.id
        and bs.ended_at is null
    ) then 'PAUZE' else 'WERKT' end as status
  from active_sessions a
  join own_workplaces ow
    on ow.event_id=a.event_id
   and ow.workplace_id=a.workplace_id
  join public.profiles p
    on p.id=a.user_id
   and p.approved=true
  join public.workplaces w
    on w.id=a.workplace_id
  where auth.uid() is not null
    and public.upt_is_approved()
    and public.upt_effective_role(auth.uid()) in ('employee','staff')
    and a.user_id<>auth.uid()
  order by w.name,p.full_name,a.id;
$function$

-- public.upt_start_break(p_work_session uuid)
CREATE OR REPLACE FUNCTION public.upt_start_break(p_work_session uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bid uuid; server_now timestamptz:=now(); v_event uuid; v_workplace uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  select ws.event_id,s.workplace_id into v_event,v_workplace
  from public.work_sessions ws join public.shifts s on s.id=ws.shift_id
  where ws.id=p_work_session and ws.user_id=auth.uid() and ws.ended_at is null for update of ws;
  if v_event is null then raise exception 'No active work session'; end if;
  if not public.upt_feature_allowed('operations',v_event,v_workplace) then raise exception 'Werk & pauze is op dit moment niet beschikbaar.'; end if;
  if exists(select 1 from public.break_sessions where work_session_id=p_work_session and ended_at is null) then raise exception 'Active break already exists'; end if;
  insert into public.break_sessions(work_session_id,user_id,start_time,started_at)
  values(p_work_session,auth.uid(),server_now,server_now) returning id into bid;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'START_BREAK','break_session',bid,jsonb_build_object('work_session_id',p_work_session,'server_timestamp',server_now));
  return bid;
end;
$function$

-- public.upt_stop_break(p_break uuid)
CREATE OR REPLACE FUNCTION public.upt_stop_break(p_break uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare server_now timestamptz:=now(); v_event uuid; v_workplace uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  select ws.event_id,s.workplace_id into v_event,v_workplace
  from public.break_sessions bs
  join public.work_sessions ws on ws.id=bs.work_session_id
  join public.shifts s on s.id=ws.shift_id
  where bs.id=p_break and bs.user_id=auth.uid() and bs.ended_at is null;
  if v_event is null then raise exception 'No active break'; end if;
  if not public.upt_feature_allowed('operations',v_event,v_workplace) then raise exception 'Werk & pauze is op dit moment niet beschikbaar.'; end if;
  update public.break_sessions set end_time=server_now,ended_at=server_now
  where id=p_break and user_id=auth.uid() and ended_at is null;
  if not found then raise exception 'No active break'; end if;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'STOP_BREAK','break_session',p_break,jsonb_build_object('server_timestamp',server_now));
end;
$function$

-- public.upt_task_reconfirm_after_change()
CREATE OR REPLACE FUNCTION public.upt_task_reconfirm_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if row(new.title,new.description,new.workplace_id) is distinct from row(old.title,old.description,old.workplace_id) then
  update public.task_assignments set confirmed_at=null,updated_at=now() where task_id=new.id;
  insert into public.crew_notifications(user_id,title,body,kind,link)
  select ta.user_id,'Taak gewijzigd — bevestig opnieuw',new.title,'task',
   case when new.promotion_only then '/portals/promotion/tasks' else '/tasks' end
  from public.task_assignments ta where ta.task_id=new.id;
 end if;
 return new;
end;
$function$

-- public.upt_upsert_event_emergency_information(p_event uuid, p_emergency_number text, p_first_aid_contact text, p_security_contact text, p_assembly_point text, p_procedure text)
CREATE OR REPLACE FUNCTION public.upt_upsert_event_emergency_information(p_event uuid, p_emergency_number text, p_first_aid_contact text DEFAULT NULL::text, p_security_contact text DEFAULT NULL::text, p_assembly_point text DEFAULT NULL::text, p_procedure text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_emergency text:=trim(coalesce(p_emergency_number,''));
  v_first_aid text:=nullif(trim(coalesce(p_first_aid_contact,'')),'');
  v_security text:=nullif(trim(coalesce(p_security_contact,'')),'');
  v_assembly text:=nullif(trim(coalesce(p_assembly_point,'')),'');
  v_procedure text:=nullif(trim(coalesce(p_procedure,'')),'');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan noodinformatie wijzigen.'; end if;
  if not public.upt_feature_allowed('emergency',p_event,null) then raise exception 'Noodinformatie is uitgeschakeld.'; end if;
  if length(v_emergency) not between 2 and 40 then raise exception 'Geef een geldig noodnummer.'; end if;
  if length(coalesce(v_first_aid,''))>300 or length(coalesce(v_security,''))>300 or length(coalesce(v_assembly,''))>500 or length(coalesce(v_procedure,''))>5000 then
    raise exception 'Noodinformatie is te lang.';
  end if;

  perform 1
  from public.events e
  where e.id=p_event
    and (e.status is null or e.status <> 'archived')
    and now()<=e.end_at + interval '3 days'
  for update;
  if not found then raise exception 'Evenement is niet beschikbaar.'; end if;

  insert into public.event_emergency_information(
    event_id,emergency_number,first_aid_contact,security_contact,assembly_point,procedure,updated_by,updated_at
  )
  values(
    p_event,v_emergency,v_first_aid,v_security,v_assembly,v_procedure,v_actor,now()
  )
  on conflict (event_id) do update
  set emergency_number=excluded.emergency_number,
      first_aid_contact=excluded.first_aid_contact,
      security_contact=excluded.security_contact,
      assembly_point=excluded.assembly_point,
      procedure=excluded.procedure,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'emergency_information.updated','event',p_event,jsonb_build_object(
    'has_first_aid',v_first_aid is not null,
    'has_security',v_security is not null,
    'has_assembly_point',v_assembly is not null,
    'has_procedure',v_procedure is not null
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select distinct target.user_id,
    'Noodinformatie bijgewerkt',
    e.name||' · controleer de actuele veiligheidsinformatie.',
    '/events',
    'emergency'
  from public.events e
  cross join lateral (
    select em.user_id from public.event_members em where em.event_id=p_event
    union
    select s.user_id from public.shifts s where s.event_id=p_event and s.status<>'cancelled' and s.response_status<>'declined'
    union
    select ra.user_id from public.responsible_assignments ra where ra.event_id=p_event
  ) target
  join public.profiles p on p.id=target.user_id and p.approved=true
  where e.id=p_event
    and target.user_id<>v_actor;
end;
$function$

-- upt_private.push_endpoint_is_safe(p_endpoint text)
CREATE OR REPLACE FUNCTION upt_private.push_endpoint_is_safe(p_endpoint text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v text:=lower(trim(coalesce(p_endpoint,'')));
  v_authority text;
  v_host text;
begin
  if char_length(v) not between 20 and 4096 or v !~ '^https://[^/?#]+/' then
    return false;
  end if;

  v_authority:=split_part(split_part(v,'://',2),'/',1);
  if v_authority='' or position('@' in v_authority)>0
     or position('[' in v_authority)>0 or position(']' in v_authority)>0 then
    return false;
  end if;

  v_host:=split_part(v_authority,':',1);
  if v_host='' or v_host !~ '^[a-z0-9.-]+$'
     or v_host not like '%.%'
     or v_host like '.%' or v_host like '%.' or v_host like '%..%' then
    return false;
  end if;

  if v_host='localhost'
     or v_host like '%.localhost'
     or v_host like '%.local'
     or v_host like '%.internal' then
    return false;
  end if;

  if v_host ~ '^[0-9]+$'
     or v_host ~ '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' then
    return false;
  end if;

  return true;
end;
$function$

-- upt_private.refresh_admin_workflow_automations()
CREATE OR REPLACE FUNCTION upt_private.refresh_admin_workflow_automations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private', 'auth'
AS $function$
declare
  v_row record;
  v_admin record;
  v_created integer:=0;
  v_delay integer;
  v_minutes integer;
  v_stage integer;
  v_blockers text[];
begin
  if upt_private.automation_enabled('account_approval_reminder',true) then
    v_delay:=upt_private.automation_int('account_approval_reminder','delay_minutes',60);
    for v_row in
      select p.id,p.full_name,au.created_at
      from public.profiles p
      join auth.users au on au.id=p.id
      where p.approved=false
        and coalesce(p.account_blocked,false)=false
        and au.created_at<=now()-make_interval(mins=>v_delay)
    loop
      for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
      loop
        if upt_private.emit_automation_notification(
          'account_approval_reminder',
          'approval:'||v_row.id::text||':'||to_char(current_date,'YYYY-MM-DD'),
          v_admin.id,
          'Account wacht op goedkeuring',
          coalesce(v_row.full_name,'Nieuwe gebruiker')||' wacht nog op accountgoedkeuring.',
          '/personnel?user='||v_row.id::text||'&focus=approval',
          'account_approval_reminder',
          jsonb_build_object('userId',v_row.id)
        ) then v_created:=v_created+1; end if;
      end loop;
    end loop;
  end if;

  if upt_private.automation_enabled('event_readiness',true) then
    for v_row in
      select e.id,e.name,e.start_at
      from public.events e
      where e.status<>'archived'
        and e.start_at>now()
        and e.start_at<=now()+interval '72 hours'
    loop
      v_blockers:=array[]::text[];
      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.responsible_assignments ra where ra.event_id=v_row.id and ra.workplace_id=w.id)
      ) then v_blockers:=array_append(v_blockers,'verantwoordelijke ontbreekt'); end if;

      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.briefings b where b.event_id=v_row.id and (b.workplace_id=w.id or b.workplace_id is null))
      ) then v_blockers:=array_append(v_blockers,'briefing ontbreekt'); end if;

      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.operational_checklists c where c.event_id=v_row.id and c.workplace_id=w.id and c.kind='opening')
      ) then v_blockers:=array_append(v_blockers,'openingchecklist ontbreekt'); end if;

      if exists(
        select 1
        from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true and w.minimum_staff>0
          and (
            select count(distinct s.user_id)
            from public.shifts s
            where s.event_id=v_row.id and s.workplace_id=w.id
              and s.status<>'cancelled'
              and coalesce(s.response_status,'pending')<>'declined'
              and s.scheduled_start<=(select end_at from public.events where id=v_row.id)
              and s.scheduled_end>=v_row.start_at
          )<w.minimum_staff
      ) then v_blockers:=array_append(v_blockers,'personeelsdekking onder minimum'); end if;

      if cardinality(v_blockers)>0 then
        v_minutes:=greatest(0,floor(extract(epoch from(v_row.start_at-now()))/60)::integer);
        v_stage:=case when v_minutes<=60 then 60 when v_minutes<=360 then 360 when v_minutes<=1440 then 1440 else 4320 end;
        for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
        loop
          if upt_private.emit_automation_notification(
            'event_readiness',
            'readiness:'||v_row.id::text||':'||v_stage::text,
            v_admin.id,
            'Event readiness vereist aandacht',
            v_row.name||': '||array_to_string(v_blockers,', ')||'.',
            '/events/'||v_row.id::text||'/command',
            'event_readiness',
            jsonb_build_object('eventId',v_row.id,'stageMinutes',v_stage,'blockers',v_blockers)
          ) then v_created:=v_created+1; end if;
        end loop;
      end if;
    end loop;
  end if;

  if upt_private.automation_enabled('event_close_ready',true) then
    for v_row in
      select e.id,e.name
      from public.events e
      where e.end_at<=now()
        and e.status not in('closed','archived')
        and not exists(select 1 from public.work_sessions ws where ws.event_id=e.id and ws.ended_at is null)
        and not exists(select 1 from public.operational_checklists c where c.event_id=e.id and c.kind='closing' and c.status<>'completed')
        and not exists(select 1 from public.incidents i where i.event_id=e.id and coalesce(i.status,'')<>'resolved' and i.resolved_at is null)
        and not exists(select 1 from public.inventory_items i where i.event_id=e.id and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0))
    loop
      for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
      loop
        if upt_private.emit_automation_notification(
          'event_close_ready',
          'close-ready:'||v_row.id::text,
          v_admin.id,
          'Evenement klaar om af te sluiten',
          v_row.name||' heeft geen openstaande afsluitblokkades meer.',
          '/events/'||v_row.id::text||'/command',
          'event_close_ready',
          jsonb_build_object('eventId',v_row.id)
        ) then v_created:=v_created+1; end if;
      end loop;
    end loop;
  end if;

  if upt_private.automation_enabled('open_task_shift_reminder',true) then
    v_delay:=upt_private.automation_int('open_task_shift_reminder','delay_minutes',30);
    for v_row in
      select distinct ta.id as assignment_id,ta.user_id,t.title,t.event_id,t.workplace_id,s.id as shift_id
      from public.task_assignments ta
      join public.tasks t on t.id=ta.task_id
      join public.shifts s on s.user_id=ta.user_id and s.event_id=t.event_id
        and (t.workplace_id is null or s.workplace_id=t.workplace_id)
      where ta.status<>'COMPLETED'
        and s.status<>'cancelled'
        and coalesce(s.response_status,'pending')<>'declined'
        and s.scheduled_start>now()
        and s.scheduled_start<=now()+make_interval(mins=>v_delay)
    loop
      if upt_private.emit_automation_notification(
        'open_task_shift_reminder',
        'task-shift:'||v_row.assignment_id::text||':'||v_row.shift_id::text,
        v_row.user_id,
        'Open taak voor je shift',
        'Nog open: '||v_row.title||'.',
        '/tasks?event='||v_row.event_id::text||coalesce('&workplace='||v_row.workplace_id::text,''),
        'task_shift_reminder',
        jsonb_build_object('eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'assignmentId',v_row.assignment_id,'shiftId',v_row.shift_id)
      ) then v_created:=v_created+1; end if;
    end loop;
  end if;

  return v_created;
end;
$function$

-- upt_private.refresh_responsible_operational_automations()
CREATE OR REPLACE FUNCTION upt_private.refresh_responsible_operational_automations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare
 v_row record;
 v_lead record;
 v_created integer:=0;
begin
 if not upt_private.automation_enabled('responsible_ops_watch',true) then return 0; end if;

 for v_row in
   select
     i.id,
     i.event_id,
     i.workplace_id,
     coalesce(nullif(i.message,''),nullif(i.description,''),'Open incident') as incident_text
   from public.incidents i
   join public.events e on e.id=i.event_id
   where i.resolved_at is null
     and lower(coalesce(i.status,''))<>'resolved'
     and now() between e.start_at and e.end_at
     and i.workplace_id is not null
 loop
   for v_lead in
     select distinct ra.user_id
     from public.responsible_assignments ra
     join public.profiles p on p.id=ra.user_id and p.approved=true
     where ra.event_id=v_row.event_id and ra.workplace_id=v_row.workplace_id
   loop
     if upt_private.emit_automation_notification(
       'responsible_ops_watch','incident:'||v_row.id::text,v_lead.user_id,
       'Open incident op jouw werkplek',v_row.incident_text,
       '/incidents?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','incident','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'incidentId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 for v_row in
   select t.id,t.event_id,t.workplace_id,t.title
   from public.tasks t
   join public.events e on e.id=t.event_id
   where t.workplace_id is not null
     and lower(coalesce(t.status,'')) not in('completed','cancelled')
     and now() between e.start_at and e.end_at
 loop
   for v_lead in
     select distinct ra.user_id
     from public.responsible_assignments ra
     join public.profiles p on p.id=ra.user_id and p.approved=true
     where ra.event_id=v_row.event_id and ra.workplace_id=v_row.workplace_id
   loop
     if upt_private.emit_automation_notification(
       'responsible_ops_watch','task-open:'||v_row.id::text,v_lead.user_id,
       'Taak vraagt opvolging',coalesce(nullif(v_row.title,''),'Een open taak op jouw werkplek vraagt opvolging.'),
       '/tasks?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','task-open','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 for v_row in
   select h.id,h.event_id,h.workplace_id,h.incoming_responsible_id
   from upt_private.shift_handovers h
   join public.events e on e.id=h.event_id
   join public.profiles p on p.id=h.incoming_responsible_id and p.approved=true
   where h.status='ready' and h.incoming_responsible_id is not null
     and h.ready_at<=now()-interval '10 minutes'
     and coalesce(e.status,'')<>'archived'
 loop
   if upt_private.emit_automation_notification(
     'responsible_ops_watch','handover-ready:'||v_row.id::text,v_row.incoming_responsible_id,
     'Werkplekoverdracht wacht op jou','Een klaargezette overdracht wacht nog op jouw acceptatie.',
     '/operations','responsible_ops_watch',
     jsonb_build_object('type','handover','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'handoverId',v_row.id)
   ) then v_created:=v_created+1; end if;
 end loop;

 return v_created;
end;
$function$

-- upt_private.refresh_staff_operational_automations()
CREATE OR REPLACE FUNCTION upt_private.refresh_staff_operational_automations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'upt_private'
AS $function$
declare v_row record; v_created integer:=0;
begin
 if not upt_private.automation_enabled('staff_ops_watch',true) then return 0; end if;

 for v_row in
   select distinct ta.user_id,t.id,t.event_id,t.workplace_id,t.title
   from public.task_assignments ta
   join public.tasks t on t.id=ta.task_id
   join public.profiles p on p.id=ta.user_id and p.approved=true
   join public.events e on e.id=t.event_id
   where lower(coalesce(t.status,'')) not in('completed','cancelled')
     and now() between e.start_at and e.end_at
     and exists(
       select 1 from public.shifts s
       where s.user_id=ta.user_id and s.event_id=t.event_id
         and s.status<>'cancelled'
         and (t.workplace_id is null or s.workplace_id=t.workplace_id)
     )
 loop
   if upt_private.emit_automation_notification(
     'staff_ops_watch','own-task:'||v_row.id::text,v_row.user_id,
     'Je hebt een open taak',coalesce(nullif(v_row.title,''),'Bekijk je open taak.'),
     '/tasks?event='||v_row.event_id::text,
     'staff_ops_watch',
     jsonb_build_object('type','own-task','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
   ) then v_created:=v_created+1; end if;
 end loop;

 for v_row in
   select distinct s.user_id,s.id as shift_id,s.event_id,s.workplace_id,b.id as briefing_id
   from public.shifts s
   join public.profiles p on p.id=s.user_id and p.approved=true
   join public.briefings b on b.event_id=s.event_id
     and b.required=true and (b.workplace_id is null or b.workplace_id=s.workplace_id)
   where s.status<>'cancelled'
     and coalesce(s.response_status,'pending')<>'declined'
     and s.scheduled_start>now() and s.scheduled_start<=now()+interval '2 hours'
     and not exists(
       select 1 from public.briefing_acknowledgements ba
       where ba.briefing_id=b.id and ba.user_id=s.user_id and ba.version=b.version
     )
 loop
   if upt_private.emit_automation_notification(
     'staff_ops_watch','briefing:'||v_row.shift_id::text||':'||v_row.briefing_id::text,v_row.user_id,
     'Briefing nog bevestigen','Lees en bevestig je verplichte briefing vóór je shift.',
     '/briefings?event='||v_row.event_id::text,
     'staff_ops_watch',
     jsonb_build_object('type','briefing','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'shiftId',v_row.shift_id,'briefingId',v_row.briefing_id)
   ) then v_created:=v_created+1; end if;
 end loop;

 return v_created;
end;
$function$
