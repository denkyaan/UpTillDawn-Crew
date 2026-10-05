-- Production completion for Driver: artist linkage, lifecycle, ETA, mileage, safeguards and Backstage dashboard.
alter table public.driver_task_details
 add column if not exists guestlist_entry_id uuid references public.event_guestlist_entries(id) on delete set null,
 add column if not exists status text not null default 'planned',
 add column if not exists expected_km numeric(10,2),
 add column if not exists eta_at timestamptz,
 add column if not exists completed_at timestamptz;

alter table public.driver_task_details drop constraint if exists driver_task_details_status_check;
alter table public.driver_task_details add constraint driver_task_details_status_check
 check(status in('planned','departing','driving','at_passenger','returning','arrived_event','completed'));

create index if not exists driver_task_details_guestlist_idx on public.driver_task_details(guestlist_entry_id);
create index if not exists driver_sessions_event_id_idx on public.driver_sessions(event_id);
create index if not exists driver_sessions_task_id_idx on public.driver_sessions(task_id);

create or replace function public.upt_set_driver_task_details(
 p_task uuid,p_direction text,p_passenger_name text,p_passenger_phone text,p_address text,
 p_scheduled_at timestamptz,p_estimated_drive_minutes integer,p_notify_at timestamptz,
 p_expected_km numeric default null,p_guestlist_entry uuid default null
) returns void language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare v_actor uuid:=auth.uid();v_event uuid;v_artist_name text;
begin
 if v_actor is null or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan Driver-ritten beheren.'; end if;
 select event_id into v_event from public.tasks where id=p_task;
 if v_event is null then raise exception 'Driver-taak niet gevonden.'; end if;
 if p_guestlist_entry is not null then
   select name into v_artist_name from public.event_guestlist_entries
   where id=p_guestlist_entry and event_id=v_event and entry_type='artist' and is_active=true;
   if not found then raise exception 'Geselecteerde artiest is niet geldig voor dit evenement.'; end if;
 end if;
 insert into public.driver_task_details(task_id,direction,passenger_name,passenger_phone,address,scheduled_at,estimated_drive_minutes,notify_at,expected_km,guestlist_entry_id,status,notified_at)
 values(p_task,p_direction,coalesce(v_artist_name,trim(p_passenger_name)),trim(p_passenger_phone),trim(p_address),p_scheduled_at,p_estimated_drive_minutes,p_notify_at,p_expected_km,p_guestlist_entry,'planned',null)
 on conflict(task_id) do update set direction=excluded.direction,passenger_name=excluded.passenger_name,passenger_phone=excluded.passenger_phone,address=excluded.address,scheduled_at=excluded.scheduled_at,estimated_drive_minutes=excluded.estimated_drive_minutes,notify_at=excluded.notify_at,expected_km=excluded.expected_km,guestlist_entry_id=excluded.guestlist_entry_id,status='planned',eta_at=null,completed_at=null,notified_at=null;
end $fn$;
revoke all on function public.upt_set_driver_task_details(uuid,text,text,text,text,timestamptz,integer,timestamptz,numeric,uuid) from public,anon;
grant execute on function public.upt_set_driver_task_details(uuid,text,text,text,text,timestamptz,integer,timestamptz,numeric,uuid) to authenticated;

create or replace function public.upt_driver_set_trip_status(p_task uuid,p_status text,p_eta timestamptz default null)
returns void language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare v_actor uuid:=auth.uid();v_event uuid;v_backstage uuid;v_message text;
begin
 if p_status not in('departing','driving','at_passenger','returning','arrived_event','completed') then raise exception 'Ongeldige ritstatus.'; end if;
 select t.event_id into v_event from public.tasks t join public.task_assignments a on a.task_id=t.id
 where t.id=p_task and a.user_id=v_actor;
 if v_event is null and not public.upt_is_admin(v_actor) then raise exception 'Geen toegang tot deze Driver-rit.'; end if;
 if v_event is null then select event_id into v_event from public.tasks where id=p_task; end if;
 update public.driver_task_details set status=p_status,eta_at=coalesce(p_eta,eta_at),completed_at=case when p_status='completed' then now() else completed_at end where task_id=p_task;
 v_backstage:=upt_private.guestlist_backstage_workplace(v_event);
 if v_backstage is not null and p_status in('returning','arrived_event') then
   select case when p_status='returning' then 'Driver rijdt terug naar het evenement met '||passenger_name||coalesce(' · ETA '||to_char(p_eta at time zone 'Europe/Brussels','HH24:MI'),'')
               else 'Driver is terug op het evenement met '||passenger_name end into v_message
   from public.driver_task_details where task_id=p_task;
   insert into public.crew_notifications(user_id,title,body,link,kind)
   select distinct r.user_id,'Driver status',v_message,'/operations?event='||v_event::text,'driver_status'
   from public.responsible_assignments r where r.event_id=v_event and r.workplace_id=v_backstage;
 end if;
end $fn$;
grant execute on function public.upt_driver_set_trip_status(uuid,text,timestamptz) to authenticated;

create or replace function upt_private.prevent_work_stop_while_driving()
returns trigger language plpgsql set search_path='pg_catalog','public' as $fn$
begin
 if old.ended_at is null and new.ended_at is not null and exists(select 1 from public.driver_sessions d where d.work_session_id=old.id and d.ended_at is null) then
   raise exception 'Stop eerst Driving voordat je de werkuren stopt.';
 end if;
 return new;
end $fn$;
drop trigger if exists prevent_work_stop_while_driving on public.work_sessions;
create trigger prevent_work_stop_while_driving before update of ended_at on public.work_sessions for each row execute function upt_private.prevent_work_stop_while_driving();

create or replace function public.upt_driver_dashboard(p_event uuid)
returns table(user_id uuid,driver_name text,trip_status text,passenger_name text,address text,eta_at timestamptz,started_at timestamptz,driving boolean,total_km numeric)
language sql stable security definer set search_path='pg_catalog','public','upt_private' as $fn$
 select p.id,p.full_name,coalesce(dtd.status,'planned'),dtd.passenger_name,dtd.address,dtd.eta_at,ds.started_at,(ds.id is not null),coalesce(ds.actual_km,ds.expected_km,dtd.expected_km,0)
 from public.shifts sh
 join public.workplaces w on w.id=sh.workplace_id and lower(w.name)='driver'
 join public.profiles p on p.id=sh.user_id
 left join public.work_sessions ws on ws.shift_id=sh.id and ws.ended_at is null
 left join public.driver_sessions ds on ds.work_session_id=ws.id and ds.ended_at is null
 left join public.driver_task_details dtd on dtd.task_id=ds.task_id
 where sh.event_id=p_event and sh.status<>'cancelled'
   and (public.upt_is_admin(auth.uid()) or public.upt_is_driver_supervisor(p_event,auth.uid()));
$fn$;
grant execute on function public.upt_driver_dashboard(uuid) to authenticated;

notify pgrst,'reload schema';