alter table public.incidents
  add column if not exists escalated_at timestamptz,
  add column if not exists escalation_reason text;

create index if not exists incidents_unacknowledged_escalation_idx
on public.incidents(created_at)
where resolved_at is null and acknowledged_at is null and escalated_at is null;

create or replace function public.upt_current_work_context()
returns table(
  session_id uuid,
  event_id uuid,
  event_name text,
  shift_id uuid,
  workplace_id uuid,
  workplace_name text,
  started_at timestamptz
)
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select
    ws.id,
    ws.event_id,
    e.name,
    ws.shift_id,
    upt_private.current_session_workplace(ws.id),
    w.name,
    ws.started_at
  from public.work_sessions ws
  join public.events e on e.id=ws.event_id
  join public.workplaces w on w.id=upt_private.current_session_workplace(ws.id)
  where ws.user_id=auth.uid()
    and ws.ended_at is null
    and public.upt_is_approved()
  order by ws.started_at desc
  limit 1;
$$;

revoke all on function public.upt_current_work_context() from public,anon;
grant execute on function public.upt_current_work_context() to authenticated;

create or replace function public.upt_create_incident(
  p_event uuid,
  p_workplace uuid,
  p_message text,
  p_photo_path text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_m numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','upt_private','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_message text:=trim(coalesce(p_message,''));
  v_media text:=nullif(trim(coalesce(p_photo_path,'')),'');
  v_incident uuid;
  v_mime text;
  v_session uuid;
  v_current_workplace uuid;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_feature_allowed('incidents',p_event,p_workplace) then raise exception 'Incidenten zijn alleen beschikbaar tijdens je actieve shift.'; end if;
  if length(v_message) not between 1 and 4000 then raise exception 'Ongeldige melding.'; end if;
  if not exists(select 1 from public.event_members em where em.event_id=p_event and em.user_id=v_actor) then raise exception 'Geen toegang tot event.'; end if;

  select ws.id,upt_private.current_session_workplace(ws.id)
  into v_session,v_current_workplace
  from public.work_sessions ws
  where ws.user_id=v_actor
    and ws.event_id=p_event
    and ws.ended_at is null
  order by ws.started_at desc
  limit 1;

  if v_session is not null then
    if p_workplace is not null and p_workplace is distinct from v_current_workplace then
      raise exception 'Melding moet aan je huidige werkplek gekoppeld worden.';
    end if;
  elsif p_workplace is not null and not exists(
    select 1
    from public.shifts s
    where s.event_id=p_event
      and s.workplace_id=p_workplace
      and s.user_id=v_actor
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and now() between s.scheduled_start and s.scheduled_end
  ) then
    raise exception 'Geen toegang tot werkplek.';
  end if;

  if v_media is not null then
    if split_part(v_media,'/',1)<>v_actor::text then raise exception 'Ongeldig mediapad.'; end if;
    select o.metadata->>'mimetype' into v_mime
    from storage.objects o
    where o.bucket_id='incident-photos' and o.name=v_media;
    if v_mime is null or v_mime not in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime') then
      raise exception 'Ongeldige incidentmedia.';
    end if;
  end if;

  if (p_latitude is null)<>(p_longitude is null) then raise exception 'Onvolledige GPS-coördinaten.'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then
    raise exception 'Ongeldige GPS-coördinaten.';
  end if;
  if p_accuracy_m is not null and p_accuracy_m<0 then raise exception 'Ongeldige GPS-nauwkeurigheid.'; end if;

  insert into public.incidents(
    user_id,reporter_id,event_id,workplace_id,message,description,
    photo_path,latitude,longitude,gps_accuracy_m
  )
  values(
    v_actor,v_actor,p_event,coalesce(p_workplace,v_current_workplace),v_message,v_message,
    v_media,p_latitude,p_longitude,p_accuracy_m
  )
  returning id into v_incident;

  insert into public.crew_notifications(user_id,title,body,kind,link)
  select distinct p.id,'URGENT',v_incident::text,'incident','/incidents?id='||v_incident::text
  from public.profiles p
  where p.approved and (
    public.upt_effective_role(p.id)='admin'
    or p.id=v_actor
    or (
      public.upt_effective_role(p.id)='responsible_lead'
      and exists (
        select 1
        from public.responsible_assignments r
        join public.shifts s
          on s.event_id=r.event_id
         and s.workplace_id=r.workplace_id
         and s.user_id=p.id
        where r.user_id=p.id
          and r.event_id=p_event
          and (coalesce(p_workplace,v_current_workplace) is null or r.workplace_id=coalesce(p_workplace,v_current_workplace))
          and s.status<>'cancelled'
          and s.response_status<>'declined'
          and now() between s.scheduled_start and s.scheduled_end
      )
    )
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'URGENT',
    'incidents',
    v_incident,
    jsonb_build_object(
      'has_media',v_media is not null,
      'media_type',v_mime,
      'has_gps',p_latitude is not null,
      'gps_accuracy_m',p_accuracy_m,
      'workplace_id',coalesce(p_workplace,v_current_workplace)
    )
  );

  return v_incident;
end;
$function$;

revoke all on function public.upt_create_incident(uuid,uuid,text,text,numeric,numeric,numeric) from public,anon;
grant execute on function public.upt_create_incident(uuid,uuid,text,text,numeric,numeric,numeric) to authenticated;

create or replace function upt_private.refresh_incident_escalations()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_incident record;
  v_count integer:=0;
begin
  for v_incident in
    select
      i.id,
      i.event_id,
      i.workplace_id,
      i.reporter_id,
      i.created_at,
      i.message
    from public.incidents i
    join public.events e on e.id=i.event_id
    where i.resolved_at is null
      and i.acknowledged_at is null
      and i.escalated_at is null
      and i.created_at<=now()-interval '5 minutes'
      and coalesce(e.status,'')<>'archived'
    order by i.created_at
    for update of i skip locked
  loop
    update public.incidents
    set escalated_at=now(),
        escalation_reason='unacknowledged-5m',
        updated_at=now()
    where id=v_incident.id;

    insert into public.crew_notifications(user_id,title,body,kind,link)
    select
      p.id,
      'HELP ESCALATIE',
      'Een help-oproep is na 5 minuten nog niet erkend.',
      'incident_escalation',
      '/incidents?id='||v_incident.id::text
    from public.profiles p
    where p.approved=true
      and p.role='admin';

    insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(
      null,
      'INCIDENT_ESCALATED',
      'incident',
      v_incident.id,
      jsonb_build_object(
        'reason','unacknowledged-5m',
        'event_id',v_incident.event_id,
        'workplace_id',v_incident.workplace_id,
        'created_at',v_incident.created_at
      )
    );

    v_count:=v_count+1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function upt_private.refresh_incident_escalations()
from public,anon,authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='uptilldawn-operational-alerts'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'uptilldawn-operational-alerts',
    '* * * * *',
    'select upt_private.refresh_operational_alerts(), upt_private.refresh_incident_escalations()'
  );
end
$$;
