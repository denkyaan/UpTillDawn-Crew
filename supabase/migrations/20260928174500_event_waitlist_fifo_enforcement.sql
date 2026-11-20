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
begin
  select e.max_joiners into v_max
  from public.events e
  where e.id=new.event_id
  for update;

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

notify pgrst,'reload schema';
