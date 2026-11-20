alter table public.shifts
  add column if not exists response_status text not null default 'pending',
  add column if not exists response_reason text,
  add column if not exists responded_at timestamptz;

update public.shifts
set response_status='accepted',
    responded_at=coalesce(responded_at,confirmed_at)
where confirmed_at is not null
  and response_status='pending';

alter table public.shifts
  drop constraint if exists shifts_response_status_check;

alter table public.shifts
  add constraint shifts_response_status_check
  check (response_status in ('pending','accepted','declined'));

alter table public.shifts
  drop constraint if exists shifts_response_reason_check;

alter table public.shifts
  add constraint shifts_response_reason_check
  check (
    response_status <> 'declined'
    or length(trim(coalesce(response_reason,''))) between 3 and 500
  );

create index if not exists shifts_planning_response_idx
on public.shifts(workplace_id,scheduled_start,scheduled_end)
where status <> 'cancelled' and response_status <> 'declined';

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
      and s.response_status <> 'declined'
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
     and s.response_status <> 'declined'
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

create or replace function public.upt_respond_shift(
  p_shift uuid,
  p_response text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_shift public.shifts%rowtype;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if p_response not in ('accepted','declined') then raise exception 'Ongeldige shiftreactie.'; end if;

  select * into v_shift
  from public.shifts
  where id=p_shift and user_id=v_uid
  for update;

  if not found then raise exception 'Dienst niet gevonden.'; end if;
  if v_shift.status='cancelled' then raise exception 'Geannuleerde dienst kan niet worden bevestigd of geweigerd.'; end if;
  if now()>v_shift.scheduled_end then raise exception 'Deze dienst is al afgelopen.'; end if;
  if exists(select 1 from public.work_sessions ws where ws.shift_id=p_shift and ws.ended_at is null) then
    raise exception 'Een actieve dienst kan niet worden geweigerd.';
  end if;

  if p_response='declined' then
    if now()>=v_shift.scheduled_start then
      raise exception 'Een gestarte dienst kan niet meer worden geweigerd.';
    end if;
    if v_reason is null or length(v_reason) not between 3 and 500 then
      raise exception 'Geef een reden van 3 tot 500 tekens.';
    end if;

    update public.shifts
    set response_status='declined',
        response_reason=v_reason,
        responded_at=now(),
        confirmed_at=null,
        updated_at=now()
    where id=p_shift;

    insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,'shift.declined','shift',p_shift,jsonb_build_object(
      'event_id',v_shift.event_id,
      'workplace_id',v_shift.workplace_id,
      'reason',v_reason
    ));

    insert into public.crew_notifications(user_id,title,body,link,kind)
    select p.id,'Dienst geweigerd',
      'Een toegewezen dienst werd geweigerd en moet worden herpland.',
      '/shifts','shift_response'
    from public.profiles p
    where p.approved=true and p.role='admin' and p.id<>v_uid;

    return;
  end if;

  perform 1
  from public.workplaces w
  where w.id=v_shift.workplace_id
  for update;
  if not found then raise exception 'Werkplek niet gevonden.'; end if;

  if not coalesce(v_shift.overlap_allowed,false) and exists(
    select 1
    from public.shifts s
    where s.id<>p_shift
      and s.user_id=v_uid
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start<v_shift.scheduled_end
      and s.scheduled_end>v_shift.scheduled_start
  ) then
    raise exception 'Dienst overlapt met een andere actieve planning.';
  end if;

  if upt_private.shift_capacity_would_exceed(
    v_shift.workplace_id,v_uid,v_shift.scheduled_start,v_shift.scheduled_end,p_shift
  ) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;

  update public.shifts
  set response_status='accepted',
      response_reason=null,
      responded_at=now(),
      confirmed_at=now(),
      updated_at=now()
  where id=p_shift;

  update public.crew_notifications
  set read_at=coalesce(read_at,now())
  where user_id=v_uid and link='/shifts' and kind='shift_assignment';

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'shift.accepted','shift',p_shift,jsonb_build_object(
    'event_id',v_shift.event_id,
    'workplace_id',v_shift.workplace_id
  ));
end;
$function$;

revoke all on function public.upt_respond_shift(uuid,text,text) from public, anon;
grant execute on function public.upt_respond_shift(uuid,text,text) to authenticated;

create or replace function public.upt_confirm_shift(p_shift uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform public.upt_respond_shift(p_shift,'accepted',null);
end;
$function$;

create or replace function public.upt_reassign_shift(
  p_shift uuid,
  p_user uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_shift public.shifts%rowtype;
  v_old_user uuid;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.upt_is_approved() then raise exception 'ACCOUNT NOT APPROVED'; end if;
  if not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan diensten herplannen.'; end if;
  if v_reason is null or length(v_reason) not between 3 and 500 then
    raise exception 'Geef een reden van 3 tot 500 tekens.';
  end if;

  select * into v_shift
  from public.shifts
  where id=p_shift
  for update;

  if not found then raise exception 'Dienst niet gevonden.'; end if;
  if v_shift.status='cancelled' then raise exception 'Geannuleerde dienst kan niet worden herpland.'; end if;
  if now()>v_shift.scheduled_end then raise exception 'Afgelopen dienst kan niet worden herpland.'; end if;
  if p_user=v_shift.user_id then raise exception 'Kies een ander personeelslid.'; end if;
  if exists(select 1 from public.work_sessions ws where ws.shift_id=p_shift and ws.ended_at is null) then
    raise exception 'Actieve werktijd verhindert herplanning.';
  end if;

  perform 1
  from public.workplaces w
  where w.id=v_shift.workplace_id and w.is_active=true
  for update;
  if not found then raise exception 'Actieve werkplek niet gevonden.'; end if;

  if not exists(
    select 1
    from public.event_members em
    join public.profiles p on p.id=em.user_id
    where em.event_id=v_shift.event_id
      and em.user_id=p_user
      and p.approved=true
  ) then
    raise exception 'Kies een goedgekeurd personeelslid van dit evenement.';
  end if;

  if not coalesce(v_shift.overlap_allowed,false) and exists(
    select 1
    from public.shifts s
    where s.id<>p_shift
      and s.user_id=p_user
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start<v_shift.scheduled_end
      and s.scheduled_end>v_shift.scheduled_start
  ) then
    raise exception 'Nieuwe medewerker heeft een overlappende dienst.';
  end if;

  if upt_private.shift_capacity_would_exceed(
    v_shift.workplace_id,p_user,v_shift.scheduled_start,v_shift.scheduled_end,p_shift
  ) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;

  v_old_user:=v_shift.user_id;

  update public.shifts
  set user_id=p_user,
      response_status='pending',
      response_reason=null,
      responded_at=null,
      confirmed_at=null,
      confirmation_revision=now(),
      updated_at=now()
  where id=p_shift;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'shift.reassigned','shift',p_shift,jsonb_build_object(
    'event_id',v_shift.event_id,
    'workplace_id',v_shift.workplace_id,
    'from_user_id',v_old_user,
    'to_user_id',p_user,
    'reason',v_reason
  ));

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values
    (p_user,'Nieuwe dienst toegewezen','Er werd een dienst aan jou toegewezen. Bevestig de dienst.','/shifts','shift_assignment'),
    (v_old_user,'Dienst herpland','Een eerder toegewezen dienst werd aan een ander personeelslid toegewezen.','/shifts','shift_reassignment');
end;
$function$;

revoke all on function public.upt_reassign_shift(uuid,uuid,text) from public, anon;
grant execute on function public.upt_reassign_shift(uuid,uuid,text) to authenticated;

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
    where s.id<>p_shift
      and s.user_id=v_shift.user_id
      and s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start<p_end
      and s.scheduled_end>p_start
  ) then raise exception 'Dienst overlapt met een bestaande dienst.'; end if;

  if upt_private.shift_capacity_would_exceed(v_shift.workplace_id,v_shift.user_id,p_start,p_end,p_shift) then
    raise exception 'Maximumbezetting van deze werkplek wordt overschreden.';
  end if;

  update public.shifts
  set role_name=trim(p_role_name),
      scheduled_start=p_start,
      scheduled_end=p_end,
      start_time=p_start,
      end_time=p_end,
      overlap_allowed=coalesce(p_overlap_allowed,false),
      shift_kind=p_shift_kind,
      response_status='pending',
      response_reason=null,
      responded_at=null,
      confirmed_at=null,
      confirmation_revision=now(),
      updated_at=now()
  where id=p_shift;
end;
$function$;
