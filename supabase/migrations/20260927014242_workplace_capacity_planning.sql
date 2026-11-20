alter table public.workplaces
  add column if not exists minimum_staff integer not null default 0,
  add column if not exists target_staff integer not null default 0,
  add column if not exists maximum_staff integer;

alter table public.workplaces
  drop constraint if exists workplaces_staffing_capacity_check;

alter table public.workplaces
  add constraint workplaces_staffing_capacity_check
  check (
    minimum_staff between 0 and 10000
    and target_staff between minimum_staff and 10000
    and (maximum_staff is null or maximum_staff between target_staff and 10000)
  );

comment on column public.workplaces.minimum_staff is 'Minimum concurrent staffing required during event hours.';
comment on column public.workplaces.target_staff is 'Target concurrent staffing during event hours.';
comment on column public.workplaces.maximum_staff is 'Optional hard maximum concurrent staffing enforced for shift planning.';

create or replace function upt_private.shift_capacity_would_exceed(
  p_workplace uuid,
  p_user uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_shift uuid default null
)
returns boolean
language sql
security definer
set search_path = 'pg_catalog', 'public', 'upt_private'
as $$
  with capacity as (
    select w.maximum_staff
    from public.workplaces w
    where w.id = p_workplace
  ),
  boundaries as (
    select p_start as at
    union
    select s.scheduled_start
    from public.shifts s
    where s.workplace_id = p_workplace
      and s.status <> 'cancelled'
      and (p_exclude_shift is null or s.id <> p_exclude_shift)
      and s.scheduled_start > p_start
      and s.scheduled_start < p_end
      and s.scheduled_end > p_start
  ),
  counts as (
    select
      b.at,
      count(distinct s.user_id)::integer as existing_staff,
      coalesce(bool_or(s.user_id = p_user), false) as user_already_present
    from boundaries b
    left join public.shifts s
      on s.workplace_id = p_workplace
     and s.status <> 'cancelled'
     and (p_exclude_shift is null or s.id <> p_exclude_shift)
     and s.scheduled_start <= b.at
     and s.scheduled_end > b.at
    group by b.at
  )
  select coalesce(
    (
      select case
        when c.maximum_staff is null then false
        else exists (
          select 1
          from counts x
          where x.existing_staff
            + case when x.user_already_present then 0 else 1 end
            > c.maximum_staff
        )
      end
      from capacity c
    ),
    false
  );
$$;

revoke all on function upt_private.shift_capacity_would_exceed(uuid, uuid, timestamptz, timestamptz, uuid)
from public, anon, authenticated;

create or replace function public.upt_create_shift(
  p_workplace uuid,
  p_user uuid,
  p_role_name text,
  p_start timestamptz,
  p_end timestamptz,
  p_overlap_allowed boolean default false,
  p_shift_kind text default 'event'
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_shift uuid;
  v_event_start timestamptz;
  v_event_end timestamptz;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan diensten aanmaken of aanpassen.'; end if;

  select w.event_id,e.start_at,e.end_at into v_event,v_event_start,v_event_end
  from public.workplaces w join public.events e on e.id=w.event_id
  where w.id=p_workplace and w.is_active=true
  for update of w;

  if v_event is null then raise exception 'Actieve werkplek niet gevonden.'; end if;
  if p_start is null or p_end is null or p_end<=p_start then raise exception 'Ongeldige dienstperiode.'; end if;
  if p_role_name is null or length(trim(p_role_name)) not between 1 and 200 then raise exception 'Ongeldige rol.'; end if;
  if p_shift_kind not in ('event','setup','breakdown') then raise exception 'Ongeldig diensttype.'; end if;

  if p_shift_kind='event' and (p_start<v_event_start or p_end>v_event_end) then
    raise exception 'Een evenementshift moet binnen de evenementuren vallen.';
  elsif p_shift_kind='setup' and (p_start<v_event_start-interval '3 days' or p_end>v_event_end) then
    raise exception 'Opbouw kan maximaal 3 dagen voor het evenement starten.';
  elsif p_shift_kind='breakdown' and (p_start<v_event_start or p_end>v_event_end+interval '3 days') then
    raise exception 'Afbouw kan maximaal 3 dagen na het evenement eindigen.';
  end if;

  if not exists (
    select 1 from public.event_members em join public.profiles p on p.id=em.user_id
    where em.event_id=v_event and em.user_id=p_user and p.approved=true
  ) then raise exception 'Goedgekeurd evenementlid vereist.'; end if;

  if not coalesce(p_overlap_allowed,false) and exists(
    select 1 from public.shifts s
    where s.user_id=p_user and s.status<>'cancelled'
      and s.scheduled_start<p_end and s.scheduled_end>p_start
  ) then raise exception 'Dienst overlapt met een bestaande dienst.'; end if;

  if upt_private.shift_capacity_would_exceed(p_workplace,p_user,p_start,p_end,null) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;

  insert into public.shifts(
    event_id,workplace_id,user_id,role_name,scheduled_start,scheduled_end,
    start_time,end_time,overlap_allowed,status,shift_kind
  ) values(
    v_event,p_workplace,p_user,trim(p_role_name),p_start,p_end,
    p_start,p_end,coalesce(p_overlap_allowed,false),'scheduled',p_shift_kind
  ) returning id into v_shift;
  return v_shift;
end;
$function$;

create or replace function public.upt_update_shift(
  p_shift uuid,
  p_role_name text,
  p_start timestamptz,
  p_end timestamptz,
  p_overlap_allowed boolean default false,
  p_shift_kind text default 'event'
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_shift public.shifts%rowtype;
  v_event_start timestamptz;
  v_event_end timestamptz;
begin
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan diensten aanmaken of aanpassen.'; end if;

  select * into v_shift from public.shifts where id=p_shift for update;
  if not found then raise exception 'Dienst niet gevonden.'; end if;
  if v_shift.status='cancelled' then raise exception 'Geannuleerde dienst kan niet worden gewijzigd.'; end if;
  if p_start is null or p_end is null or p_end<=p_start then raise exception 'Ongeldige dienstperiode.'; end if;
  if p_role_name is null or length(trim(p_role_name)) not between 1 and 200 then raise exception 'Ongeldige rol.'; end if;
  if p_shift_kind not in ('event','setup','breakdown') then raise exception 'Ongeldig diensttype.'; end if;

  select e.start_at,e.end_at
  into v_event_start,v_event_end
  from public.events e
  join public.workplaces w on w.id=v_shift.workplace_id
  where e.id=v_shift.event_id
  for update of w;

  if p_shift_kind='event' and (p_start<v_event_start or p_end>v_event_end) then
    raise exception 'Een evenementshift moet binnen de evenementuren vallen.';
  elsif p_shift_kind='setup' and (p_start<v_event_start-interval '3 days' or p_end>v_event_end) then
    raise exception 'Opbouw kan maximaal 3 dagen voor het evenement starten.';
  elsif p_shift_kind='breakdown' and (p_start<v_event_start or p_end>v_event_end+interval '3 days') then
    raise exception 'Afbouw kan maximaal 3 dagen na het evenement eindigen.';
  end if;

  if exists(select 1 from public.work_sessions ws where ws.shift_id=p_shift and ws.ended_at is null) then
    raise exception 'Actieve werktijd verhindert wijziging van de dienst.';
  end if;

  if not coalesce(p_overlap_allowed,false) and exists(
    select 1 from public.shifts s
    where s.id<>p_shift and s.user_id=v_shift.user_id and s.status<>'cancelled'
      and s.scheduled_start<p_end and s.scheduled_end>p_start
  ) then raise exception 'Dienst overlapt met een bestaande dienst.'; end if;

  if upt_private.shift_capacity_would_exceed(v_shift.workplace_id,v_shift.user_id,p_start,p_end,p_shift) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;

  update public.shifts
  set role_name=trim(p_role_name),scheduled_start=p_start,scheduled_end=p_end,
      start_time=p_start,end_time=p_end,overlap_allowed=coalesce(p_overlap_allowed,false),
      shift_kind=p_shift_kind,updated_at=now()
  where id=p_shift;
end;
$function$;
