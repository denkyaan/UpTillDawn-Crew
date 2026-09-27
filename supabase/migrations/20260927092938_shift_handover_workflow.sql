create table if not exists upt_private.shift_handovers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  outgoing_responsible_id uuid not null references public.profiles(id) on delete cascade,
  incoming_responsible_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','accepted')),
  open_task_ids uuid[] not null default '{}'::uuid[],
  open_incident_ids uuid[] not null default '{}'::uuid[],
  equipment_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  accepted_at timestamptz
);

alter table upt_private.shift_handovers enable row level security;

drop policy if exists shift_handovers_no_direct_access on upt_private.shift_handovers;
create policy shift_handovers_no_direct_access
on upt_private.shift_handovers
as restrictive
for all
to public
using (false)
with check (false);

revoke all on table upt_private.shift_handovers from public,anon,authenticated;

create unique index if not exists shift_handovers_active_outgoing_idx
on upt_private.shift_handovers(event_id,workplace_id,outgoing_responsible_id)
where status in ('draft','ready');

create index if not exists shift_handovers_incoming_idx
on upt_private.shift_handovers(incoming_responsible_id,status,updated_at desc);

create index if not exists shift_handovers_workplace_idx
on upt_private.shift_handovers(event_id,workplace_id,status,updated_at desc);

create or replace function public.upt_handover_candidates(
  p_event uuid,
  p_workplace uuid
)
returns table(
  user_id uuid,
  full_name text
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select distinct p.id,p.full_name
  from public.responsible_assignments ra
  join public.profiles p on p.id=ra.user_id
  join public.workplaces w on w.id=ra.workplace_id and w.event_id=ra.event_id
  where ra.event_id=p_event
    and ra.workplace_id=p_workplace
    and p.approved=true
    and p.id<>auth.uid()
    and public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or public.upt_is_responsible(p_event,p_workplace,auth.uid())
    )
  order by p.full_name nulls last,p.id;
$$;

revoke all on function public.upt_handover_candidates(uuid,uuid) from public,anon;
grant execute on function public.upt_handover_candidates(uuid,uuid) to authenticated;

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

revoke all on function public.upt_save_shift_handover(uuid,uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.upt_save_shift_handover(uuid,uuid,uuid,text,text,boolean) to authenticated;

create or replace function public.upt_accept_shift_handover(
  p_handover uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_handover upt_private.shift_handovers%rowtype;
begin
  if v_actor is null then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;

  select * into v_handover
  from upt_private.shift_handovers
  where id=p_handover
  for update;

  if not found then raise exception 'Overdracht niet gevonden.'; end if;
  if v_handover.status<>'ready' then raise exception 'Deze overdracht is niet klaar voor acceptatie.'; end if;
  if v_handover.incoming_responsible_id is distinct from v_actor then
    raise exception 'Deze overdracht is niet aan jou toegewezen.';
  end if;
  if not public.upt_is_responsible(v_handover.event_id,v_handover.workplace_id,v_actor) then
    raise exception 'Je bent niet langer verantwoordelijke voor deze werkplek.';
  end if;

  update upt_private.shift_handovers
  set status='accepted',
      accepted_at=now(),
      updated_at=now()
  where id=p_handover;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'SHIFT_HANDOVER_ACCEPTED',
    'shift_handover',
    p_handover,
    jsonb_build_object(
      'event_id',v_handover.event_id,
      'workplace_id',v_handover.workplace_id,
      'outgoing_responsible_id',v_handover.outgoing_responsible_id,
      'open_task_count',coalesce(cardinality(v_handover.open_task_ids),0),
      'open_incident_count',coalesce(cardinality(v_handover.open_incident_ids),0)
    )
  );

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(
    v_handover.outgoing_responsible_id,
    'Overdracht geaccepteerd',
    'De inkomende verantwoordelijke heeft de werkplekoverdracht geaccepteerd.',
    '/operations',
    'shift_handover'
  );
end;
$function$;

revoke all on function public.upt_accept_shift_handover(uuid) from public,anon;
grant execute on function public.upt_accept_shift_handover(uuid) to authenticated;

create or replace function public.upt_shift_handovers()
returns table(
  id uuid,
  event_id uuid,
  workplace_id uuid,
  outgoing_responsible_id uuid,
  outgoing_name text,
  incoming_responsible_id uuid,
  incoming_name text,
  status text,
  open_task_ids uuid[],
  open_incident_ids uuid[],
  equipment_notes text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  ready_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    h.id,
    h.event_id,
    h.workplace_id,
    h.outgoing_responsible_id,
    outgoing.full_name,
    h.incoming_responsible_id,
    incoming.full_name,
    h.status,
    h.open_task_ids,
    h.open_incident_ids,
    h.equipment_notes,
    h.notes,
    h.created_at,
    h.updated_at,
    h.ready_at,
    h.accepted_at
  from upt_private.shift_handovers h
  join public.profiles outgoing on outgoing.id=h.outgoing_responsible_id
  left join public.profiles incoming on incoming.id=h.incoming_responsible_id
  where public.upt_is_approved()
    and (
      public.upt_is_admin(auth.uid())
      or h.outgoing_responsible_id=auth.uid()
      or h.incoming_responsible_id=auth.uid()
    )
  order by
    case h.status when 'ready' then 0 when 'draft' then 1 else 2 end,
    h.updated_at desc;
$$;

revoke all on function public.upt_shift_handovers() from public,anon;
grant execute on function public.upt_shift_handovers() to authenticated;
