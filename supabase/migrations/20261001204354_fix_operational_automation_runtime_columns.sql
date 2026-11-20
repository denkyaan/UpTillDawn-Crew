create or replace function upt_private.refresh_responsible_operational_automations()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
 v_row record;
 v_lead record;
 v_created integer:=0;
begin
 if not upt_private.automation_enabled('responsible_ops_watch',true) then return 0; end if;

 for v_row in
   select
     i.id,
     i.event_id,
     i.workplace_id,
     coalesce(nullif(i.message,''),nullif(i.description,''),'Open incident') as incident_text
   from public.incidents i
   join public.events e on e.id=i.event_id
   where i.resolved_at is null
     and lower(coalesce(i.status,''))<>'resolved'
     and now() between e.start_at and e.end_at
     and i.workplace_id is not null
 loop
   for v_lead in
     select distinct ra.user_id
     from public.responsible_assignments ra
     join public.profiles p on p.id=ra.user_id and p.approved=true
     where ra.event_id=v_row.event_id and ra.workplace_id=v_row.workplace_id
   loop
     if upt_private.emit_automation_notification(
       'responsible_ops_watch','incident:'||v_row.id::text,v_lead.user_id,
       'Open incident op jouw werkplek',v_row.incident_text,
       '/incidents?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','incident','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'incidentId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 for v_row in
   select t.id,t.event_id,t.workplace_id,t.title
   from public.tasks t
   join public.events e on e.id=t.event_id
   where t.workplace_id is not null
     and lower(coalesce(t.status,'')) not in('completed','cancelled')
     and now() between e.start_at and e.end_at
 loop
   for v_lead in
     select distinct ra.user_id
     from public.responsible_assignments ra
     join public.profiles p on p.id=ra.user_id and p.approved=true
     where ra.event_id=v_row.event_id and ra.workplace_id=v_row.workplace_id
   loop
     if upt_private.emit_automation_notification(
       'responsible_ops_watch','task-open:'||v_row.id::text,v_lead.user_id,
       'Taak vraagt opvolging',coalesce(nullif(v_row.title,''),'Een open taak op jouw werkplek vraagt opvolging.'),
       '/tasks?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','task-open','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 for v_row in
   select h.id,h.event_id,h.workplace_id,h.incoming_responsible_id
   from upt_private.shift_handovers h
   join public.events e on e.id=h.event_id
   join public.profiles p on p.id=h.incoming_responsible_id and p.approved=true
   where h.status='ready' and h.incoming_responsible_id is not null
     and h.ready_at<=now()-interval '10 minutes'
     and coalesce(e.status,'')<>'archived'
 loop
   if upt_private.emit_automation_notification(
     'responsible_ops_watch','handover-ready:'||v_row.id::text,v_row.incoming_responsible_id,
     'Werkplekoverdracht wacht op jou','Een klaargezette overdracht wacht nog op jouw acceptatie.',
     '/operations','responsible_ops_watch',
     jsonb_build_object('type','handover','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'handoverId',v_row.id)
   ) then v_created:=v_created+1; end if;
 end loop;

 return v_created;
end;
$$;

revoke all on function upt_private.refresh_responsible_operational_automations() from public,anon,authenticated;

create or replace function upt_private.refresh_staff_operational_automations()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare v_row record; v_created integer:=0;
begin
 if not upt_private.automation_enabled('staff_ops_watch',true) then return 0; end if;

 for v_row in
   select distinct ta.user_id,t.id,t.event_id,t.workplace_id,t.title
   from public.task_assignments ta
   join public.tasks t on t.id=ta.task_id
   join public.profiles p on p.id=ta.user_id and p.approved=true
   join public.events e on e.id=t.event_id
   where lower(coalesce(t.status,'')) not in('completed','cancelled')
     and now() between e.start_at and e.end_at
     and exists(
       select 1 from public.shifts s
       where s.user_id=ta.user_id and s.event_id=t.event_id
         and s.status<>'cancelled'
         and (t.workplace_id is null or s.workplace_id=t.workplace_id)
     )
 loop
   if upt_private.emit_automation_notification(
     'staff_ops_watch','own-task:'||v_row.id::text,v_row.user_id,
     'Je hebt een open taak',coalesce(nullif(v_row.title,''),'Bekijk je open taak.'),
     '/tasks?event='||v_row.event_id::text,
     'staff_ops_watch',
     jsonb_build_object('type','own-task','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
   ) then v_created:=v_created+1; end if;
 end loop;

 for v_row in
   select distinct s.user_id,s.id as shift_id,s.event_id,s.workplace_id,b.id as briefing_id
   from public.shifts s
   join public.profiles p on p.id=s.user_id and p.approved=true
   join public.briefings b on b.event_id=s.event_id
     and b.required=true and (b.workplace_id is null or b.workplace_id=s.workplace_id)
   where s.status<>'cancelled'
     and coalesce(s.response_status,'pending')<>'declined'
     and s.scheduled_start>now() and s.scheduled_start<=now()+interval '2 hours'
     and not exists(
       select 1 from public.briefing_acknowledgements ba
       where ba.briefing_id=b.id and ba.user_id=s.user_id and ba.version=b.version
     )
 loop
   if upt_private.emit_automation_notification(
     'staff_ops_watch','briefing:'||v_row.shift_id::text||':'||v_row.briefing_id::text,v_row.user_id,
     'Briefing nog bevestigen','Lees en bevestig je verplichte briefing vóór je shift.',
     '/briefings?event='||v_row.event_id::text,
     'staff_ops_watch',
     jsonb_build_object('type','briefing','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'shiftId',v_row.shift_id,'briefingId',v_row.briefing_id)
   ) then v_created:=v_created+1; end if;
 end loop;

 return v_created;
end;
$$;

revoke all on function upt_private.refresh_staff_operational_automations() from public,anon,authenticated;
