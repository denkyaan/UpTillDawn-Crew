-- Notify Backstage Management when a Driver returns to the event with an artist.
create or replace function public.upt_stop_driving(
 p_driver_session uuid,p_latitude numeric default null,p_longitude numeric default null,p_actual_km numeric default null
) returns void language plpgsql security definer set search_path='pg_catalog','public','upt_private' as $fn$
declare
 v_row public.driver_sessions%rowtype;
 v_direction text;v_passenger text;v_guestlist uuid;v_backstage uuid;v_channel uuid;v_message text;v_notification_count integer:=0;
begin
 select * into v_row from public.driver_sessions where id=p_driver_session and user_id=auth.uid() and ended_at is null for update;
 if not found then raise exception 'Geen actieve Driving-registratie.'; end if;

 update public.driver_sessions
 set ended_at=now(),end_latitude=p_latitude,end_longitude=p_longitude,actual_km=coalesce(p_actual_km,expected_km)
 where id=p_driver_session;

 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'STOP_DRIVING','driver_session',p_driver_session,jsonb_build_object('work_session_id',v_row.work_session_id,'actual_km',coalesce(p_actual_km,v_row.expected_km)));

 if v_row.task_id is not null and v_row.artist_arrival_notified_at is null then
   select d.direction,d.passenger_name,d.guestlist_entry_id into v_direction,v_passenger,v_guestlist
   from public.driver_task_details d where d.task_id=v_row.task_id;

   -- A pickup ending at the event means the Driver has arrived with the artist.
   if lower(coalesce(v_direction,''))='pickup' and v_guestlist is not null and nullif(trim(coalesce(v_passenger,'')),'') is not null then
     v_backstage:=upt_private.guestlist_backstage_workplace(v_row.event_id);
     v_message:='Driver is aangekomen op het evenement met artiest - '||v_passenger||'.';

     update public.driver_sessions set artist_arrival_notified_at=now() where id=p_driver_session;

     if v_backstage is not null then
       insert into public.crew_notifications(user_id,title,body,link,kind)
       select distinct r.user_id,'Driver · artiest aangekomen',v_message,
              '/tasks?event='||v_row.event_id::text,'driver_artist_arrival'
       from public.responsible_assignments r
       where r.event_id=v_row.event_id and r.workplace_id=v_backstage;
       get diagnostics v_notification_count=row_count;

       select c.id into v_channel
       from public.chat_channels c
       where c.kind='workplace' and c.event_id=v_row.event_id and c.workplace_id=v_backstage
       order by c.created_at limit 1;

       if v_channel is not null then
         insert into public.messages(user_id,sender_id,channel_id,body,content,event_id,workplace_id)
         values(auth.uid(),auth.uid(),v_channel,v_message,v_message,v_row.event_id,v_backstage);
       end if;
     end if;

     if v_backstage is null or v_notification_count=0 then
       insert into public.crew_notifications(user_id,title,body,link,kind)
       select p.id,'Backstage opvolging vereist',
              v_message||case when v_backstage is null then ' Stel een backstage werkplek in.' else ' Er is geen backstage manager toegewezen.' end,
              '/tasks?event='||v_row.event_id::text,'driver_artist_arrival_setup'
       from public.profiles p
       where p.role='admin' and p.approved=true and coalesce(p.account_blocked,false)=false;
     end if;
   end if;
 end if;
end $fn$;

revoke all on function public.upt_stop_driving(uuid,numeric,numeric,numeric) from public,anon;
grant execute on function public.upt_stop_driving(uuid,numeric,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
