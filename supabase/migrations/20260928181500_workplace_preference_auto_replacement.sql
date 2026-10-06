alter table public.profiles
  add column if not exists preferred_workplace_id uuid
  references public.workplace_catalog(id) on delete set null;

create index if not exists profiles_preferred_workplace_idx
  on public.profiles(preferred_workplace_id);

create or replace function public.upt_own_workplace_preference()
returns uuid
language sql
stable
security definer
set search_path='pg_catalog','public'
as $$
  select preferred_workplace_id
  from public.profiles
  where id=auth.uid()
$$;

create or replace function public.upt_set_own_workplace_preference(p_workplace uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Aanmelden vereist.';
  end if;

  if p_workplace is not null and not exists(
    select 1 from public.workplace_catalog wc
    where wc.id=p_workplace and wc.is_active=true
  ) then
    raise exception 'Werkplekvoorkeur is niet geldig.';
  end if;

  update public.profiles
  set preferred_workplace_id=p_workplace,
      updated_at=now()
  where id=auth.uid();

  if not found then
    raise exception 'Profiel niet gevonden.';
  end if;
end;
$$;

revoke all on function public.upt_own_workplace_preference(),
                       public.upt_set_own_workplace_preference(uuid)
from public,anon;
grant execute on function public.upt_own_workplace_preference(),
                          public.upt_set_own_workplace_preference(uuid)
to authenticated;

create or replace function upt_private.enforce_event_member_capacity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_max integer;
  v_count integer;
  v_candidate_queue timestamptz;
  v_older_waiting boolean:=false;
  v_auto_replacement boolean:=coalesce(current_setting('upt.auto_replacement',true),'off')='on';
begin
  select e.max_joiners into v_max
  from public.events e
  where e.id=new.event_id
  for update;

  if not v_auto_replacement then
    select ea.queue_joined_at
    into v_candidate_queue
    from public.event_availability ea
    where ea.event_id=new.event_id
      and ea.user_id=new.user_id
      and ea.response='can';

    select exists(
      select 1
      from public.event_availability ea
      where ea.event_id=new.event_id
        and ea.response='can'
        and not exists(
          select 1 from public.event_members em
          where em.event_id=ea.event_id and em.user_id=ea.user_id
        )
        and ea.user_id<>new.user_id
        and (
          v_candidate_queue is null
          or ea.queue_joined_at<v_candidate_queue
          or (ea.queue_joined_at=v_candidate_queue and ea.user_id::text<new.user_id::text)
        )
    ) into v_older_waiting;

    if v_older_waiting then
      raise exception 'Er staat nog iemand vóór deze persoon op de wachtlijst.';
    end if;
  end if;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count
  from public.event_members em
  where em.event_id=new.event_id
    and em.user_id<>new.user_id;

  if v_count>=v_max then
    raise exception 'Maximum aantal bevestigde deelnemers bereikt (%/%).',v_count,v_max;
  end if;

  return new;
end;
$$;

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

  insert into public.crew_notifications(user_id,title,body,kind,link)
  select p.id,'Personeelsuitval',
    coalesce(v_outgoing_name,'Een medewerker')||' heeft zich afgemeld voor '||
    coalesce(v_event_name,'het evenement')||
    case when v_workplace_name is not null then ' ('||v_workplace_name||').' else '.' end,
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
  set status='cancelled',updated_at=now()
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
