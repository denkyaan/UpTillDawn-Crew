-- Complete Driver trip workflow: secure detail mutation and departure reminders.
create or replace function public.upt_set_driver_task_details(
  p_task uuid,
  p_direction text,
  p_passenger_name text,
  p_passenger_phone text,
  p_address text,
  p_scheduled_at timestamptz,
  p_estimated_drive_minutes integer,
  p_notify_at timestamptz
) returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan Driver-ritten beheren.'; end if;
  if p_direction not in('pickup','dropoff') then raise exception 'Ongeldig rittype.'; end if;
  if length(trim(coalesce(p_passenger_name,''))) not between 1 and 200 then raise exception 'Ongeldige naam.'; end if;
  if length(trim(coalesce(p_passenger_phone,''))) not between 1 and 60 then raise exception 'Ongeldig telefoonnummer.'; end if;
  if length(trim(coalesce(p_address,''))) not between 1 and 500 then raise exception 'Ongeldig adres.'; end if;
  if p_estimated_drive_minutes is null or p_estimated_drive_minutes<0 then raise exception 'Ongeldige reistijd.'; end if;
  if not exists(
    select 1 from public.tasks t
    join public.workplaces w on w.id=t.workplace_id
    where t.id=p_task and lower(w.name)='driver'
  ) then raise exception 'Driver-taak niet gevonden.'; end if;

  insert into public.driver_task_details(
    task_id,direction,passenger_name,passenger_phone,address,scheduled_at,
    estimated_drive_minutes,notify_at,notified_at
  ) values(
    p_task,p_direction,trim(p_passenger_name),trim(p_passenger_phone),trim(p_address),p_scheduled_at,
    p_estimated_drive_minutes,p_notify_at,null
  )
  on conflict(task_id) do update set
    direction=excluded.direction,
    passenger_name=excluded.passenger_name,
    passenger_phone=excluded.passenger_phone,
    address=excluded.address,
    scheduled_at=excluded.scheduled_at,
    estimated_drive_minutes=excluded.estimated_drive_minutes,
    notify_at=excluded.notify_at,
    notified_at=null;
end
$fn$;

revoke all on function public.upt_set_driver_task_details(uuid,text,text,text,text,timestamptz,integer,timestamptz) from public,anon;
grant execute on function public.upt_set_driver_task_details(uuid,text,text,text,text,timestamptz,integer,timestamptz) to authenticated;

create or replace function upt_private.send_driver_departure_reminders()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare v_trip record; v_count integer:=0;
begin
  for v_trip in
    select d.task_id,d.direction,d.passenger_name,d.passenger_phone,d.address,d.scheduled_at,
           d.estimated_drive_minutes,d.notify_at,a.user_id,e.name as event_name
    from public.driver_task_details d
    join public.tasks t on t.id=d.task_id
    join public.events e on e.id=t.event_id
    join public.task_assignments a on a.task_id=t.id
    where d.notified_at is null
      and d.notify_at is not null
      and d.notify_at<=now()
      and d.scheduled_at>now()-interval '30 minutes'
      and a.status<>'COMPLETED'
    order by d.notify_at
    for update of d skip locked
  loop
    update public.driver_task_details set notified_at=now() where task_id=v_trip.task_id and notified_at is null;
    if not found then continue; end if;
    insert into public.crew_notifications(user_id,title,body,kind,link)
    values(
      v_trip.user_id,
      case when v_trip.direction='pickup' then 'Vertrek voor ophaling' else 'Vertrek voor afzetrit' end,
      v_trip.event_name||' · '||
      case when v_trip.direction='pickup' then 'Ophalen: ' else 'Afzetten: ' end||
      v_trip.passenger_name||' · '||v_trip.passenger_phone||' · '||v_trip.address||
      ' · rit ±'||v_trip.estimated_drive_minutes||' min · 15 min vertrekmarge.',
      'driver_departure',
      '/tasks'
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$fn$;

revoke all on function upt_private.send_driver_departure_reminders() from public,anon,authenticated;

do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='uptilldawn-driver-reminders' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('uptilldawn-driver-reminders','* * * * *','select upt_private.send_driver_departure_reminders()');
end $$;

notify pgrst,'reload schema';
