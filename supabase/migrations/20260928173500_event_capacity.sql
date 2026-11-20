alter table public.events
  add column if not exists max_joiners integer;

alter table public.events
  drop constraint if exists events_max_joiners_positive;
alter table public.events
  add constraint events_max_joiners_positive
  check (max_joiners is null or max_joiners between 1 and 10000);

create or replace function upt_private.enforce_event_member_capacity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_max integer;
  v_count integer;
begin
  select e.max_joiners into v_max
  from public.events e
  where e.id=new.event_id
  for update;

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

revoke all on function upt_private.enforce_event_member_capacity() from public,anon,authenticated;

drop trigger if exists trg_enforce_event_member_capacity on public.event_members;
create trigger trg_enforce_event_member_capacity
before insert or update of event_id,user_id on public.event_members
for each row
execute function upt_private.enforce_event_member_capacity();

notify pgrst,'reload schema';
