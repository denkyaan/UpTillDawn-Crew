-- Responsible operational automation effects. Configuration remains God Mode-only.
insert into public.automation_rules(
 automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,cooldown_minutes,max_retries,settings
) values
 ('responsible_ops_watch','Verantwoordelijke operationele opvolging','Meldt werkplekverantwoordelijken automatisch open operationele uitzonderingen binnen hun eigen actieve werkplek.',true,'runtime_check','notify_responsible',0,10,15,'responsible',array['in_app','push'],false,10,3,'{"managed":"built_in","configuration":"god_mode_only"}')
on conflict(automation_key) do update set
 description=excluded.description,
 audience=excluded.audience,
 settings=public.automation_rules.settings||excluded.settings;

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

 -- Active unresolved incidents: keep the responsible informed until resolution,
 -- without leaking incidents from other workplaces.
 for v_row in
   select i.id,i.event_id,i.workplace_id,coalesce(i.title,'Open incident') as title
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
       'Open incident op jouw werkplek',v_row.title,
       '/incidents?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','incident','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'incidentId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 -- Overdue tasks in an active workplace.
 for v_row in
   select t.id,t.event_id,t.workplace_id,t.title
   from public.tasks t
   join public.events e on e.id=t.event_id
   where t.workplace_id is not null
     and lower(coalesce(t.status,'')) not in('completed','cancelled')
     and t.due_at is not null and t.due_at<=now()
     and now() between e.start_at and e.end_at
 loop
   for v_lead in
     select distinct ra.user_id
     from public.responsible_assignments ra
     join public.profiles p on p.id=ra.user_id and p.approved=true
     where ra.event_id=v_row.event_id and ra.workplace_id=v_row.workplace_id
   loop
     if upt_private.emit_automation_notification(
       'responsible_ops_watch','task-overdue:'||v_row.id::text,v_lead.user_id,
       'Taak vraagt opvolging',coalesce(v_row.title,'Een taak op jouw werkplek is te laat.'),
       '/tasks?event='||v_row.event_id::text||'&workplace='||v_row.workplace_id::text,
       'responsible_ops_watch',
       jsonb_build_object('type','task-overdue','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
     ) then v_created:=v_created+1; end if;
   end loop;
 end loop;

 -- Ready handovers awaiting the incoming responsible.
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

do $$
declare v_job_id bigint;
begin
 select jobid into v_job_id from cron.job where jobname='uptilldawn-responsible-ops' limit 1;
 if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
 perform cron.schedule(
   'uptilldawn-responsible-ops',
   '*/5 * * * *',
   'select upt_private.refresh_responsible_operational_automations()'
 );
end $$;
