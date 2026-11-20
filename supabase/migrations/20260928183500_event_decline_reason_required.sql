alter table public.event_availability
  add column if not exists decline_reason text;

create or replace function public.upt_set_event_availability_with_reason(
  p_event uuid,
  p_response text,
  p_setup boolean,
  p_breakdown boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_deadline timestamptz;
  v_end timestamptz;
  v_existing_response text;
  v_existing_queue timestamptz;
  v_is_member boolean:=false;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if auth.uid() is null or not public.upt_is_approved() then
    raise exception 'Authentication required';
  end if;
  if p_response not in ('can','cannot') then
    raise exception 'Invalid response';
  end if;

  select coalesce(e.registration_deadline,e.start_at),e.end_at
  into v_deadline,v_end
  from public.events e
  where e.id=p_event and e.status<>'archived';

  if v_deadline is null then raise exception 'Evenement niet gevonden.'; end if;

  select ea.response,ea.queue_joined_at
  into v_existing_response,v_existing_queue
  from public.event_availability ea
  where ea.event_id=p_event and ea.user_id=auth.uid();

  select exists(
    select 1 from public.event_members em
    where em.event_id=p_event and em.user_id=auth.uid()
  ) into v_is_member;

  if p_response='can' and now()>=v_deadline and coalesce(v_existing_response,'')<>'can' then
    raise exception 'De aanmelddeadline voor dit evenement is verstreken.';
  end if;

  if p_response='cannot' and now()>v_end then
    raise exception 'Dit evenement is afgelopen.';
  end if;

  if p_response='cannot'
     and (coalesce(v_existing_response,'')='can' or v_is_member)
     and (v_reason is null or length(v_reason)<3) then
    raise exception 'Geef een reden waarom je niet meer kunt deelnemen.';
  end if;

  if v_reason is not null and length(v_reason)>1000 then
    raise exception 'De afmeldreden mag maximaal 1000 tekens bevatten.';
  end if;

  insert into public.event_availability(
    event_id,user_id,response,responded_at,updated_at,setup_available,breakdown_available,
    queue_joined_at,decline_reason
  )
  values(
    p_event,auth.uid(),p_response,now(),now(),p_setup,p_breakdown,
    case when p_response='can' then now() else null end,
    case when p_response='cannot' then v_reason else null end
  )
  on conflict(event_id,user_id)
  do update set
    response=excluded.response,
    responded_at=now(),
    updated_at=now(),
    setup_available=excluded.setup_available,
    breakdown_available=excluded.breakdown_available,
    decline_reason=case when excluded.response='cannot' then excluded.decline_reason else null end,
    queue_joined_at=case
      when excluded.response='cannot' then null
      when public.event_availability.response='can'
           and public.event_availability.queue_joined_at is not null
        then public.event_availability.queue_joined_at
      else now()
    end;
end
$function$;

revoke all on function public.upt_set_event_availability_with_reason(uuid,text,boolean,boolean,text) from public,anon;
grant execute on function public.upt_set_event_availability_with_reason(uuid,text,boolean,boolean,text) to authenticated;

create or replace function upt_private.handle_confirmed_member_decline()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_event_name text;
  v_max integer;
  v_end timestamptz;
  v_was_member boolean:=false;
  v_workplace uuid;
  v_catalog_workplace uuid;
  v_workplace_name text;
  v_replacement uuid;
  v_replacement_name text;
  v_outgoing_name text;
  v_role text;
  v_cancelled_at timestamptz:=clock_timestamp();
  v_reason text:=nullif(trim(coalesce(new.decline_reason,'')),'');
begin
  if new.response<>'cannot' or old.response is not distinct from 'cannot' then
    return new;
  end if;

  select e.name,e.max_joiners,e.end_at,p.full_name
  into v_event_name,v_max,v_end,v_outgoing_name
  from public.events e
  left join public.profiles p on p.id=new.user_id
  where e.id=new.event_id;

  select s.workplace_id,w.catalog_workplace_id,w.name
  into v_workplace,v_catalog_workplace,v_workplace_name
  from public.shifts s
  join public.workplaces w on w.id=s.workplace_id
  where s.event_id=new.event_id
    and s.user_id=new.user_id
    and coalesce(s.status,'')<>'cancelled'
    and s.scheduled_end>now()
  order by s.scheduled_start
  limit 1;

  delete from public.event_members
  where event_id=new.event_id
    and user_id=new.user_id
  returning true into v_was_member;

  if not coalesce(v_was_member,false) then return new; end if;

  if v_reason is null or length(v_reason)<3 then
    raise exception 'Afmeldreden is verplicht voor een bevestigde deelnemer.';
  end if;

  insert into public.crew_notifications(user_id,title,body,kind,link)
  select p.id,'Personeelsuitval',
    coalesce(v_outgoing_name,'Een medewerker')||' heeft zich afgemeld voor '||
    coalesce(v_event_name,'het evenement')||
    case when v_workplace_name is not null then ' ('||v_workplace_name||').' else '.' end||
    ' Reden: '||v_reason,
    'event_staff_dropout','/events?event='||new.event_id::text
  from public.profiles p
  where p.approved=true and p.role='admin';

  if v_workplace is not null and v_catalog_workplace is not null and now()<=v_end then
    select ea.user_id,p.full_name,p.role
    into v_replacement,v_replacement_name,v_role
    from public.event_availability ea
    join public.profiles p on p.id=ea.user_id
    where ea.event_id=new.event_id
      and ea.response='can'
      and ea.user_id<>new.user_id
      and p.approved=true
      and coalesce(p.account_blocked,false)=false
      and p.preferred_workplace_id=v_catalog_workplace
      and not exists(
        select 1 from public.event_members em
        where em.event_id=ea.event_id and em.user_id=ea.user_id
      )
      and not exists(
        select 1
        from public.shifts candidate_shift
        join public.shifts outgoing_shift
          on outgoing_shift.event_id=new.event_id
         and outgoing_shift.user_id=new.user_id
         and outgoing_shift.workplace_id=v_workplace
         and coalesce(outgoing_shift.status,'')<>'cancelled'
         and outgoing_shift.scheduled_end>now()
        where candidate_shift.user_id=ea.user_id
          and coalesce(candidate_shift.status,'')<>'cancelled'
          and candidate_shift.scheduled_start<outgoing_shift.scheduled_end
          and candidate_shift.scheduled_end>outgoing_shift.scheduled_start
      )
    order by ea.queue_joined_at asc nulls last,ea.user_id
    limit 1
    for update of ea skip locked;
  end if;

  update public.shifts
  set status='cancelled',updated_at=v_cancelled_at
  where event_id=new.event_id
    and user_id=new.user_id
    and coalesce(status,'')<>'cancelled'
    and scheduled_end>now();

  if v_replacement is not null then
    perform set_config('upt.auto_replacement','on',true);

    insert into public.event_members(event_id,user_id,event_role)
    values(
      new.event_id,
      v_replacement,
      case when v_role='responsible_lead' then 'responsible_lead'
           when v_role='admin' then 'admin'
           else 'employee' end
    )
    on conflict(event_id,user_id) do nothing;

    insert into public.shifts(
      event_id,workplace_id,user_id,start_time,end_time,role,role_name,
      responsible_lead_id,scheduled_start,scheduled_end,status,overlap_allowed,
      notes,updated_at,shift_kind,response_status
    )
    select
      s.event_id,s.workplace_id,v_replacement,s.start_time,s.end_time,s.role,s.role_name,
      s.responsible_lead_id,s.scheduled_start,s.scheduled_end,'scheduled',s.overlap_allowed,
      coalesce(s.notes,'')||case when coalesce(s.notes,'')='' then '' else E'\n' end||
        'Automatisch overgenomen na uitval.',
      now(),s.shift_kind,'pending'
    from public.shifts s
    where s.event_id=new.event_id
      and s.user_id=new.user_id
      and s.workplace_id=v_workplace
      and s.status='cancelled'
      and s.updated_at=v_cancelled_at
      and s.scheduled_end>now()
      and not exists(
        select 1 from public.shifts existing
        where existing.event_id=s.event_id
          and existing.user_id=v_replacement
          and existing.workplace_id=s.workplace_id
          and existing.scheduled_start=s.scheduled_start
          and existing.scheduled_end=s.scheduled_end
          and coalesce(existing.status,'')<>'cancelled'
      );

    insert into public.crew_notifications(user_id,title,body,kind,link)
    select p.id,'Automatische vervanger toegewezen',
      coalesce(v_replacement_name,'Een wachtlijstkandidaat')||
      ' is automatisch toegewezen aan '||coalesce(v_workplace_name,'de vrijgekomen werkplek')||
      ' voor '||coalesce(v_event_name,'het evenement')||'.',
      'event_auto_replacement_admin','/events?event='||new.event_id::text
    from public.profiles p
    where p.approved=true and p.role='admin';

    insert into public.crew_notifications(user_id,title,body,kind,link)
    values(
      v_replacement,'Je bent automatisch toegevoegd',
      'Er kwam een plaats vrij voor '||coalesce(v_event_name,'het evenement')||
      '. Omdat '||coalesce(v_workplace_name,'de werkplek')||
      ' jouw werkplekvoorkeur is en je eerstvolgende geschikte kandidaat was, ben je automatisch toegewezen.',
      'event_auto_replacement','/events?event='||new.event_id::text
    );
  elsif v_max is not null and now()<=v_end then
    insert into public.crew_notifications(user_id,title,body,kind,link)
    select ea.user_id,'Plaats vrijgekomen voor evenement',
      'Er is een plaats vrijgekomen voor '||coalesce(v_event_name,'het evenement')||
      '. Er was geen automatische vervanger met dezelfde werkplekvoorkeur.',
      'event_spot_open','/events?event='||new.event_id::text
    from public.event_availability ea
    join public.profiles p on p.id=ea.user_id
    where ea.event_id=new.event_id
      and ea.response='can'
      and ea.user_id<>new.user_id
      and p.approved=true
      and coalesce(p.account_blocked,false)=false
      and not exists(
        select 1 from public.event_members em
        where em.event_id=ea.event_id and em.user_id=ea.user_id
      );
  end if;

  return new;
end;
$$;

revoke all on function upt_private.handle_confirmed_member_decline() from public,anon,authenticated;

notify pgrst,'reload schema';
