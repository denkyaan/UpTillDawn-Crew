-- Staff operational automation effects. Rules are configured only through God Mode.
insert into public.automation_rules(
 automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,cooldown_minutes,max_retries,settings
) values
 ('staff_ops_watch','Personeel operationele opvolging','Geeft personeel automatisch gerichte opvolging voor eigen open taken en verplichte briefing binnen de toegewezen shiftcontext.',true,'runtime_check','notify_user',0,15,null,'affected',array['in_app','push'],false,15,3,'{"managed":"built_in","configuration":"god_mode_only"}')
on conflict(automation_key) do update set
 description=excluded.description,
 audience=excluded.audience,
 settings=public.automation_rules.settings||excluded.settings;

create or replace function upt_private.refresh_staff_operational_automations()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare v_row record; v_created integer:=0;
begin
 if not upt_private.automation_enabled('staff_ops_watch',true) then return 0; end if;

 -- Own overdue assignments only; never expose another crew member's task.
 for v_row in
   select distinct ta.user_id,t.id,t.event_id,t.workplace_id,t.title
   from public.task_assignments ta
   join public.tasks t on t.id=ta.task_id
   join public.profiles p on p.id=ta.user_id and p.approved=true
   join public.events e on e.id=t.event_id
   where lower(coalesce(t.status,'')) not in('completed','cancelled')
     and t.due_at is not null and t.due_at<=now()
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
     'Je hebt een open taak',coalesce(v_row.title,'Bekijk je open taak.'),
     '/tasks?event='||v_row.event_id::text,
     'staff_ops_watch',
     jsonb_build_object('type','own-task','eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'taskId',v_row.id)
   ) then v_created:=v_created+1; end if;
 end loop;

 -- Required briefing still unread shortly before an accepted confirmed shift.
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

do $$
declare v_job_id bigint;
begin
 select jobid into v_job_id from cron.job where jobname='uptilldawn-staff-ops' limit 1;
 if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
 perform cron.schedule('uptilldawn-staff-ops','*/5 * * * *','select upt_private.refresh_staff_operational_automations()');
end $$;
