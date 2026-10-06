alter table public.events
  add column if not exists registration_deadline timestamptz;

update public.events
set registration_deadline=start_at
where registration_deadline is null;

alter table public.events
  drop constraint if exists events_registration_deadline_before_start;
alter table public.events
  add constraint events_registration_deadline_before_start
  check (registration_deadline is null or registration_deadline <= start_at);

drop policy if exists event_availability_insert on public.event_availability;
create policy event_availability_insert
on public.event_availability
for insert
to authenticated
with check (
  public.upt_is_approved()
  and user_id=(select auth.uid())
  and exists (
    select 1 from public.events e
    where e.id=event_availability.event_id
      and e.status<>'archived'
      and now()<coalesce(e.registration_deadline,e.start_at)
  )
);

drop policy if exists event_availability_update on public.event_availability;
create policy event_availability_update
on public.event_availability
for update
to authenticated
using (
  public.upt_is_approved()
  and user_id=(select auth.uid())
)
with check (
  public.upt_is_approved()
  and user_id=(select auth.uid())
  and exists (
    select 1 from public.events e
    where e.id=event_availability.event_id
      and e.status<>'archived'
      and now()<coalesce(e.registration_deadline,e.start_at)
  )
);

drop policy if exists events_read on public.events;
create policy events_read
on public.events
for select
to authenticated
using (
  public.upt_is_admin()
  or (
    public.upt_is_approved()
    and status<>'archived'
    and now()<=end_at
  )
  or public.upt_is_responsible(id,null,(select auth.uid()))
  or exists(
    select 1 from public.event_members em
    where em.event_id=events.id and em.user_id=(select auth.uid())
  )
);

drop policy if exists upt_event_visibility_window on public.events;
create policy upt_event_visibility_window
on public.events
as restrictive
for select
to authenticated
using (
  public.upt_is_admin()
  or (
    public.upt_is_approved()
    and status<>'archived'
    and now()<=end_at
  )
  or (
    (
      public.upt_is_responsible(id,null,(select auth.uid()))
      or exists(
        select 1 from public.event_members em
        where em.event_id=events.id and em.user_id=(select auth.uid())
      )
    )
    and now()<=end_at+interval '3 days'
  )
);

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
declare v_deadline timestamptz;
begin
  if auth.uid() is null or not public.upt_is_approved() then
    raise exception 'Authentication required';
  end if;
  if p_response not in ('can','cannot') then
    raise exception 'Invalid response';
  end if;

  select coalesce(e.registration_deadline,e.start_at)
  into v_deadline
  from public.events e
  where e.id=p_event and e.status<>'archived';

  if v_deadline is null then
    raise exception 'Evenement niet gevonden.';
  end if;
  if now()>=v_deadline then
    raise exception 'De aanmelddeadline voor dit evenement is verstreken.';
  end if;

  insert into public.event_availability(
    event_id,user_id,response,responded_at,updated_at,setup_available,breakdown_available
  )
  values(p_event,auth.uid(),p_response,now(),now(),p_setup,p_breakdown)
  on conflict(event_id,user_id)
  do update set
    response=excluded.response,
    responded_at=now(),
    updated_at=now(),
    setup_available=excluded.setup_available,
    breakdown_available=excluded.breakdown_available;
end
$function$;

notify pgrst,'reload schema';
