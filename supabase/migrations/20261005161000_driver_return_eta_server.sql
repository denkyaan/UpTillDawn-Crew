create or replace function public.upt_driver_set_trip_status(p_task uuid,p_status text,p_eta timestamptz default null)
returns void language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare v_actor uuid:=auth.uid();v_event uuid;v_backstage uuid;v_message text;v_eta timestamptz;
begin
 if p_status not in('departing','driving','at_passenger','returning','arrived_event','completed') then raise exception 'Ongeldige ritstatus.'; end if;
 select t.event_id into v_event from public.tasks t join public.task_assignments a on a.task_id=t.id where t.id=p_task and a.user_id=v_actor;
 if v_event is null and not public.upt_is_admin(v_actor) then raise exception 'Geen toegang tot deze Driver-rit.'; end if;
 if v_event is null then select event_id into v_event from public.tasks where id=p_task; end if;
 select case when p_status='returning' then coalesce(p_eta,now()+make_interval(mins=>coalesce(estimated_drive_minutes,0))) else p_eta end into v_eta from public.driver_task_details where task_id=p_task;
 update public.driver_task_details set status=p_status,eta_at=coalesce(v_eta,eta_at),completed_at=case when p_status='completed' then now() else completed_at end where task_id=p_task;
 v_backstage:=upt_private.guestlist_backstage_workplace(v_event);
 if v_backstage is not null and p_status in('returning','arrived_event') then
   select case when p_status='returning' then 'Driver rijdt terug naar het evenement met '||passenger_name||coalesce(' · ETA '||to_char(v_eta at time zone 'Europe/Brussels','HH24:MI'),'') else 'Driver is terug op het evenement met '||passenger_name end into v_message from public.driver_task_details where task_id=p_task;
   insert into public.crew_notifications(user_id,title,body,link,kind)
   select distinct r.user_id,'Driver status',v_message,'/operations?event='||v_event::text,'driver_status' from public.responsible_assignments r where r.event_id=v_event and r.workplace_id=v_backstage;
 end if;
end $fn$;
grant execute on function public.upt_driver_set_trip_status(uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';