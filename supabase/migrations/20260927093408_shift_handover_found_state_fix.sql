create or replace function public.upt_save_shift_handover(
  p_event uuid,
  p_workplace uuid,
  p_incoming uuid default null,
  p_equipment_notes text default null,
  p_notes text default null,
  p_mark_ready boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_handover upt_private.shift_handovers%rowtype;
  v_tasks uuid[];
  v_incidents uuid[];
  v_equipment text:=nullif(trim(coalesce(p_equipment_notes,'')),'');
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_existing boolean:=false;
  v_was_ready boolean:=false;
  v_incoming_changed boolean:=false;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_is_responsible(p_event,p_workplace,v_actor) then
    raise exception 'Alleen de verantwoordelijke van deze werkplek kan een overdracht voorbereiden.';
  end if;

  if not exists(
    select 1
    from public.workplaces w
    join public.events e on e.id=w.event_id
    where w.id=p_workplace
      and w.event_id=p_event
      and w.is_active=true
      and coalesce(e.status,'')<>'archived'
  ) then raise exception 'Actieve werkplek niet gevonden.'; end if;

  if length(coalesce(v_equipment,''))>2000 or length(coalesce(v_notes,''))>4000 then
    raise exception 'Overdrachtsnotities zijn te lang.';
  end if;

  if p_incoming is not null then
    if p_incoming=v_actor then raise exception 'Kies een andere verantwoordelijke.'; end if;
    if not exists(
      select 1
      from public.responsible_assignments ra
      join public.profiles p on p.id=ra.user_id
      where ra.event_id=p_event
        and ra.workplace_id=p_workplace
        and ra.user_id=p_incoming
        and p.approved=true
    ) then raise exception 'Inkomende verantwoordelijke heeft geen geldige werkplektoewijzing.'; end if;
  end if;

  if p_mark_ready and p_incoming is null then
    raise exception 'Selecteer een inkomende verantwoordelijke voordat je de overdracht klaarzet.';
  end if;

  select * into v_handover
  from upt_private.shift_handovers h
  where h.event_id=p_event
    and h.workplace_id=p_workplace
    and h.outgoing_responsible_id=v_actor
    and h.status in ('draft','ready')
  order by h.created_at desc
  limit 1
  for update;

  v_existing:=found;
  v_was_ready:=v_existing and v_handover.status='ready';
  v_incoming_changed:=v_existing and v_handover.incoming_responsible_id is distinct from p_incoming;

  if p_mark_ready then
    select coalesce(array_agg(t.id order by t.created_at),'{}'::uuid[])
    into v_tasks
    from public.tasks t
    where t.event_id=p_event
      and t.workplace_id=p_workplace
      and lower(coalesce(t.status,'')) not in ('completed','cancelled');

    select coalesce(array_agg(i.id order by i.created_at),'{}'::uuid[])
    into v_incidents
    from public.incidents i
    where i.event_id=p_event
      and i.workplace_id=p_workplace
      and i.resolved_at is null
      and lower(coalesce(i.status,''))<>'resolved';
  else
    v_tasks:=coalesce(v_handover.open_task_ids,'{}'::uuid[]);
    v_incidents:=coalesce(v_handover.open_incident_ids,'{}'::uuid[]);
  end if;

  if not v_existing then
    insert into upt_private.shift_handovers(
      event_id,workplace_id,outgoing_responsible_id,incoming_responsible_id,status,
      open_task_ids,open_incident_ids,equipment_notes,notes,ready_at,updated_at
    )
    values(
      p_event,p_workplace,v_actor,p_incoming,
      case when p_mark_ready then 'ready' else 'draft' end,
      v_tasks,v_incidents,v_equipment,v_notes,
      case when p_mark_ready then now() else null end,
      now()
    )
    returning * into v_handover;
  else
    update upt_private.shift_handovers
    set incoming_responsible_id=p_incoming,
        status=case when p_mark_ready then 'ready' else 'draft' end,
        open_task_ids=v_tasks,
        open_incident_ids=v_incidents,
        equipment_notes=v_equipment,
        notes=v_notes,
        ready_at=case when p_mark_ready then coalesce(ready_at,now()) else null end,
        updated_at=now()
    where id=v_handover.id
    returning * into v_handover;
  end if;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    case when p_mark_ready then 'SHIFT_HANDOVER_READY' else 'SHIFT_HANDOVER_DRAFT_SAVED' end,
    'shift_handover',
    v_handover.id,
    jsonb_build_object(
      'event_id',p_event,
      'workplace_id',p_workplace,
      'incoming_responsible_id',p_incoming,
      'open_task_count',coalesce(cardinality(v_tasks),0),
      'open_incident_count',coalesce(cardinality(v_incidents),0)
    )
  );

  if p_mark_ready and p_incoming is not null and (not v_was_ready or v_incoming_changed) then
    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(
      p_incoming,
      'Overdracht klaar',
      'De werkplekverantwoordelijke heeft een overdracht voor jou klaargezet.',
      '/operations',
      'shift_handover'
    );
  end if;

  return v_handover.id;
end;
$function$;
