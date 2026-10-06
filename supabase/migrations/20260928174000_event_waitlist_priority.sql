alter table public.event_availability
  add column if not exists queue_joined_at timestamptz;

update public.event_availability
set queue_joined_at=coalesce(queue_joined_at,responded_at,updated_at)
where response='can' and queue_joined_at is null;

create or replace function public.upt_set_event_availability_extended(
  p_event uuid,
  p_response text,
  p_setup boolean,
  p_breakdown boolean
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

  if v_deadline is null then
    raise exception 'Evenement niet gevonden.';
  end if;

  select ea.response,ea.queue_joined_at
  into v_existing_response,v_existing_queue
  from public.event_availability ea
  where ea.event_id=p_event and ea.user_id=auth.uid();

  if p_response='can' and now()>=v_deadline and coalesce(v_existing_response,'')<>'can' then
    raise exception 'De aanmelddeadline voor dit evenement is verstreken.';
  end if;

  if p_response='cannot' and now()>v_end then
    raise exception 'Dit evenement is afgelopen.';
  end if;

  insert into public.event_availability(
    event_id,user_id,response,responded_at,updated_at,setup_available,breakdown_available,queue_joined_at
  )
  values(
    p_event,auth.uid(),p_response,now(),now(),p_setup,p_breakdown,
    case when p_response='can' then now() else null end
  )
  on conflict(event_id,user_id)
  do update set
    response=excluded.response,
    responded_at=now(),
    updated_at=now(),
    setup_available=excluded.setup_available,
    breakdown_available=excluded.breakdown_available,
    queue_joined_at=case
      when excluded.response='cannot' then null
      when public.event_availability.response='can' and public.event_availability.queue_joined_at is not null
        then public.event_availability.queue_joined_at
      else now()
    end;
end
$function$;

create or replace function upt_private.handle_confirmed_member_decline()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_name text;
  v_max integer;
  v_end timestamptz;
  v_was_member boolean:=false;
begin
  if new.response<>'cannot' or old.response is not distinct from 'cannot' then
    return new;
  end if;

  select e.name,e.max_joiners,e.end_at
  into v_name,v_max,v_end
  from public.events e
  where e.id=new.event_id;

  delete from public.event_members
  where event_id=new.event_id
    and user_id=new.user_id
  returning true into v_was_member;

  if coalesce(v_was_member,false)
     and v_max is not null
     and now()<=v_end then

    update public.shifts
    set status='cancelled'
    where event_id=new.event_id
      and user_id=new.user_id
      and coalesce(status,'')<>'cancelled'
      and scheduled_start>now();

    insert into public.crew_notifications(user_id,title,body,kind,link)
    select
      ea.user_id,
      'Plaats vrijgekomen voor evenement',
      'Er is een plaats vrijgekomen voor '||coalesce(v_name,'het evenement')||
      '. Je staat op de wachtlijst met voorrang op niet-geregistreerde kandidaten.',
      'event_spot_open',
      '/events?event='||new.event_id::text
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
      )
    order by ea.queue_joined_at asc nulls last;
  end if;

  return new;
end;
$$;

revoke all on function upt_private.handle_confirmed_member_decline() from public,anon,authenticated;

drop trigger if exists trg_handle_confirmed_member_decline on public.event_availability;
create trigger trg_handle_confirmed_member_decline
after update of response on public.event_availability
for each row
execute function upt_private.handle_confirmed_member_decline();

notify pgrst,'reload schema';
