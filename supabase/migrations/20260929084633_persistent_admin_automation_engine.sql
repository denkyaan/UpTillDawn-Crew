create table if not exists public.automation_rules(
  automation_key text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  trigger_key text not null,
  action_key text not null,
  delay_minutes integer not null default 0 check(delay_minutes>=0 and delay_minutes<=43200),
  reminder_minutes integer check(reminder_minutes is null or (reminder_minutes>=1 and reminder_minutes<=43200)),
  escalation_minutes integer check(escalation_minutes is null or (escalation_minutes>=1 and escalation_minutes<=43200)),
  audience text not null default 'admin' check(audience in('admin','responsible','staff','affected','all')),
  channels text[] not null default array['in_app','push']::text[],
  auto_action boolean not null default false,
  audit_enabled boolean not null default true,
  cooldown_minutes integer not null default 60 check(cooldown_minutes>=0 and cooldown_minutes<=43200),
  max_retries integer not null default 3 check(max_retries>=0 and max_retries<=20),
  settings jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.automation_rules enable row level security;

drop policy if exists automation_rules_admin_select on public.automation_rules;
create policy automation_rules_admin_select on public.automation_rules
for select to authenticated
using(public.upt_is_approved() and public.upt_is_admin(auth.uid()));

drop policy if exists automation_rules_admin_update on public.automation_rules;
create policy automation_rules_admin_update on public.automation_rules
for update to authenticated
using(public.upt_is_approved() and public.upt_is_admin(auth.uid()))
with check(public.upt_is_approved() and public.upt_is_admin(auth.uid()));

revoke all on table public.automation_rules from public,anon;
grant select,update on table public.automation_rules to authenticated;

create table if not exists upt_private.automation_deliveries(
  id uuid primary key default gen_random_uuid(),
  automation_key text not null references public.automation_rules(automation_key) on delete cascade,
  dedupe_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  delivered_at timestamptz not null default now(),
  unique(automation_key,dedupe_key,user_id)
);
alter table upt_private.automation_deliveries enable row level security;
revoke all on table upt_private.automation_deliveries from public,anon,authenticated;

insert into public.automation_rules(
 automation_key,label,description,enabled,trigger_key,action_key,delay_minutes,reminder_minutes,escalation_minutes,audience,channels,auto_action,cooldown_minutes,max_retries,settings
) values
 ('shift_reminders','Shiftherinneringen','Stuurt automatische herinneringen vóór een geplande shift. De bestaande serverlogica voorkomt dubbele meldingen.',true,'shift_starting','notify_user',0,15,null,'affected',array['in_app','push'],false,15,3,'{"managed":"built_in"}'),
 ('break_reminders','Pauzecontrole','Bewaakt het pauzetegoed en stuurt reminders rond het einde van de verplichte pauze.',true,'break_started','notify_user',0,5,10,'affected',array['in_app','push'],false,5,3,'{"managed":"built_in"}'),
 ('operational_alerts','Werkuren & no-show controle','Detecteert te late check-ins, no-shows, onderbezetting, shiftuitloop, ontbrekende checkout en te lange pauzes.',true,'runtime_check','create_alert',0,5,15,'admin',array['in_app','push'],false,5,3,'{"managed":"built_in"}'),
 ('incident_escalation','Help-escalatie','Escalatie van niet erkende help- en incidentmeldingen naar verantwoordelijke en admin.',true,'incident_created','escalate_incident',5,5,5,'admin',array['in_app','push'],false,5,3,'{"managed":"built_in"}'),
 ('platform_intelligence','Operationele kwaliteitscontrole','Controleert ontbrekende verantwoordelijken, briefingbevestigingen, lage voorraad, checklists en automatische eventrapporten.',true,'platform_check','create_alert',0,60,null,'admin',array['in_app','push'],false,30,3,'{"managed":"built_in"}'),
 ('data_anomalies','Data-afwijkingen','Controleert automatisch op inconsistente of verdachte operationele data en brengt die onder de aandacht.',true,'data_check','create_alert',0,60,null,'admin',array['in_app'],false,60,3,'{"managed":"built_in"}'),
 ('account_approval_reminder','Open accountgoedkeuring','Herinnert admins wanneer een nieuwe accountaanvraag te lang op goedkeuring wacht. Accounts worden nooit automatisch goedgekeurd.',true,'account_pending','notify_admin',60,1440,null,'admin',array['in_app','push'],false,1440,3,'{"managed":"workflow"}'),
 ('event_readiness','Event readiness','Controleert vóór het evenement op ontbrekende verantwoordelijken, briefing, openingchecklists en personeelsdekking. Meldt op belangrijke tijdsmomenten.',true,'event_starting','notify_admin',4320,1440,null,'admin',array['in_app','push'],false,60,3,'{"managed":"workflow","stages_minutes":[4320,1440,360,60]}'),
 ('event_close_ready','Klaar om evenement af te sluiten','Meldt wanneer een afgelopen evenement geen actieve uren, open incidenten, sluitchecklists of inventory-afwijkingen meer heeft en veilig kan worden afgesloten.',true,'event_ended','notify_admin',0,null,null,'admin',array['in_app','push'],false,60,3,'{"managed":"workflow"}'),
 ('open_task_shift_reminder','Open taken vóór shift','Herinnert een medewerker kort vóór de shift aan nog open toegewezen taken voor die event- of werkplekcontext.',true,'shift_starting','notify_user',30,null,null,'affected',array['in_app','push'],false,30,3,'{"managed":"workflow"}')
on conflict(automation_key) do nothing;

create or replace function upt_private.automation_enabled(p_key text,p_default boolean default true)
returns boolean
language sql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $$
  select coalesce((select enabled from public.automation_rules where automation_key=p_key),p_default);
$$;
revoke all on function upt_private.automation_enabled(text,boolean) from public,anon,authenticated;

create or replace function upt_private.automation_int(p_key text,p_field text,p_default integer)
returns integer
language plpgsql
stable
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare v integer;
begin
  select case p_field
    when 'delay_minutes' then delay_minutes
    when 'reminder_minutes' then reminder_minutes
    when 'escalation_minutes' then escalation_minutes
    when 'cooldown_minutes' then cooldown_minutes
    when 'max_retries' then max_retries
    else null
  end into v
  from public.automation_rules where automation_key=p_key;
  return coalesce(v,p_default);
end;
$$;
revoke all on function upt_private.automation_int(text,text,integer) from public,anon,authenticated;

create or replace function upt_private.emit_automation_notification(
  p_rule text,
  p_dedupe text,
  p_user uuid,
  p_title text,
  p_body text,
  p_link text,
  p_kind text,
  p_context jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare v_id uuid;
begin
  if not upt_private.automation_enabled(p_rule,true) then return false; end if;

  insert into upt_private.automation_deliveries(automation_key,dedupe_key,user_id,context)
  values(p_rule,p_dedupe,p_user,coalesce(p_context,'{}'::jsonb))
  on conflict(automation_key,dedupe_key,user_id) do nothing
  returning id into v_id;

  if v_id is null then return false; end if;

  insert into public.crew_notifications(user_id,title,body,link,kind)
  values(p_user,p_title,p_body,p_link,p_kind);

  update public.automation_rules
  set last_run_at=now()
  where automation_key=p_rule;

  return true;
end;
$$;
revoke all on function upt_private.emit_automation_notification(text,text,uuid,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function upt_private.refresh_admin_workflow_automations()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private','auth'
as $$
declare
  v_row record;
  v_admin record;
  v_created integer:=0;
  v_delay integer;
  v_minutes integer;
  v_stage integer;
  v_blockers text[];
begin
  if upt_private.automation_enabled('account_approval_reminder',true) then
    v_delay:=upt_private.automation_int('account_approval_reminder','delay_minutes',60);
    for v_row in
      select p.id,p.full_name,au.created_at
      from public.profiles p
      join auth.users au on au.id=p.id
      where p.approved=false
        and coalesce(p.account_blocked,false)=false
        and au.created_at<=now()-make_interval(mins=>v_delay)
    loop
      for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
      loop
        if upt_private.emit_automation_notification(
          'account_approval_reminder',
          'approval:'||v_row.id::text||':'||to_char(current_date,'YYYY-MM-DD'),
          v_admin.id,
          'Account wacht op goedkeuring',
          coalesce(v_row.full_name,'Nieuwe gebruiker')||' wacht nog op accountgoedkeuring.',
          '/personnel?user='||v_row.id::text||'&focus=approval',
          'account_approval_reminder',
          jsonb_build_object('userId',v_row.id)
        ) then v_created:=v_created+1; end if;
      end loop;
    end loop;
  end if;

  if upt_private.automation_enabled('event_readiness',true) then
    for v_row in
      select e.id,e.name,e.start_at
      from public.events e
      where e.status<>'archived'
        and e.start_at>now()
        and e.start_at<=now()+interval '72 hours'
    loop
      v_blockers:=array[]::text[];
      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.responsible_assignments ra where ra.event_id=v_row.id and ra.workplace_id=w.id)
      ) then v_blockers:=array_append(v_blockers,'verantwoordelijke ontbreekt'); end if;

      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.briefings b where b.event_id=v_row.id and (b.workplace_id=w.id or b.workplace_id is null))
      ) then v_blockers:=array_append(v_blockers,'briefing ontbreekt'); end if;

      if exists(
        select 1 from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true
          and not exists(select 1 from public.operational_checklists c where c.event_id=v_row.id and c.workplace_id=w.id and c.kind='opening')
      ) then v_blockers:=array_append(v_blockers,'openingchecklist ontbreekt'); end if;

      if exists(
        select 1
        from public.workplaces w
        where w.event_id=v_row.id and w.is_active=true and w.minimum_staff>0
          and (
            select count(distinct s.user_id)
            from public.shifts s
            where s.event_id=v_row.id and s.workplace_id=w.id
              and s.status<>'cancelled'
              and coalesce(s.response_status,'pending')<>'declined'
              and s.scheduled_start<=(select end_at from public.events where id=v_row.id)
              and s.scheduled_end>=v_row.start_at
          )<w.minimum_staff
      ) then v_blockers:=array_append(v_blockers,'personeelsdekking onder minimum'); end if;

      if cardinality(v_blockers)>0 then
        v_minutes:=greatest(0,floor(extract(epoch from(v_row.start_at-now()))/60)::integer);
        v_stage:=case when v_minutes<=60 then 60 when v_minutes<=360 then 360 when v_minutes<=1440 then 1440 else 4320 end;
        for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
        loop
          if upt_private.emit_automation_notification(
            'event_readiness',
            'readiness:'||v_row.id::text||':'||v_stage::text,
            v_admin.id,
            'Event readiness vereist aandacht',
            v_row.name||': '||array_to_string(v_blockers,', ')||'.',
            '/events/'||v_row.id::text||'/command',
            'event_readiness',
            jsonb_build_object('eventId',v_row.id,'stageMinutes',v_stage,'blockers',v_blockers)
          ) then v_created:=v_created+1; end if;
        end loop;
      end if;
    end loop;
  end if;

  if upt_private.automation_enabled('event_close_ready',true) then
    for v_row in
      select e.id,e.name
      from public.events e
      where e.end_at<=now()
        and e.status not in('closed','archived')
        and not exists(select 1 from public.work_sessions ws where ws.event_id=e.id and ws.ended_at is null)
        and not exists(select 1 from public.operational_checklists c where c.event_id=e.id and c.kind='closing' and c.status<>'completed')
        and not exists(select 1 from public.incidents i where i.event_id=e.id and coalesce(i.status,'')<>'resolved' and i.resolved_at is null)
        and not exists(select 1 from public.inventory_items i where i.event_id=e.id and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0))
    loop
      for v_admin in select p.id from public.profiles p where p.approved=true and public.upt_is_admin(p.id)
      loop
        if upt_private.emit_automation_notification(
          'event_close_ready',
          'close-ready:'||v_row.id::text,
          v_admin.id,
          'Evenement klaar om af te sluiten',
          v_row.name||' heeft geen openstaande afsluitblokkades meer.',
          '/events/'||v_row.id::text||'/command',
          'event_close_ready',
          jsonb_build_object('eventId',v_row.id)
        ) then v_created:=v_created+1; end if;
      end loop;
    end loop;
  end if;

  if upt_private.automation_enabled('open_task_shift_reminder',true) then
    v_delay:=upt_private.automation_int('open_task_shift_reminder','delay_minutes',30);
    for v_row in
      select distinct ta.id as assignment_id,ta.user_id,t.title,t.event_id,t.workplace_id,s.id as shift_id
      from public.task_assignments ta
      join public.tasks t on t.id=ta.task_id
      join public.shifts s on s.user_id=ta.user_id and s.event_id=t.event_id
        and (t.workplace_id is null or s.workplace_id=t.workplace_id)
      where ta.status<>'COMPLETED'
        and s.status<>'cancelled'
        and coalesce(s.response_status,'pending')<>'declined'
        and s.scheduled_start>now()
        and s.scheduled_start<=now()+make_interval(mins=>v_delay)
    loop
      if upt_private.emit_automation_notification(
        'open_task_shift_reminder',
        'task-shift:'||v_row.assignment_id::text||':'||v_row.shift_id::text,
        v_row.user_id,
        'Open taak voor je shift',
        'Nog open: '||v_row.title||'.',
        '/tasks?event='||v_row.event_id::text||coalesce('&workplace='||v_row.workplace_id::text,''),
        'task_shift_reminder',
        jsonb_build_object('eventId',v_row.event_id,'workplaceId',v_row.workplace_id,'assignmentId',v_row.assignment_id,'shiftId',v_row.shift_id)
      ) then v_created:=v_created+1; end if;
    end loop;
  end if;

  return v_created;
end;
$$;
revoke all on function upt_private.refresh_admin_workflow_automations() from public,anon,authenticated;

create or replace function upt_private.run_automation_cycle()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_shift integer:=0;
  v_break integer:=0;
  v_ops integer:=0;
  v_incidents integer:=0;
  v_platform integer:=0;
  v_anomalies integer:=0;
  v_workflows integer:=0;
begin
  if upt_private.automation_enabled('shift_reminders',true) then v_shift:=upt_private.send_shift_reminders(); end if;
  if upt_private.automation_enabled('break_reminders',true) then v_break:=upt_private.notify_break_allowance(); end if;
  if upt_private.automation_enabled('operational_alerts',true) then v_ops:=upt_private.refresh_operational_alerts(); end if;
  if upt_private.automation_enabled('incident_escalation',true) then v_incidents:=upt_private.refresh_incident_escalations(); end if;
  if upt_private.automation_enabled('platform_intelligence',true) then v_platform:=upt_private.refresh_platform_intelligence(); end if;
  if upt_private.automation_enabled('data_anomalies',true) then v_anomalies:=upt_private.refresh_data_anomalies(); end if;
  v_workflows:=upt_private.refresh_admin_workflow_automations();

  return jsonb_build_object(
    'shiftReminders',v_shift,'breakReminders',v_break,'operationalAlerts',v_ops,
    'incidentEscalations',v_incidents,'platformIntelligence',v_platform,
    'dataAnomalies',v_anomalies,'workflowNotifications',v_workflows
  );
end;
$$;
revoke all on function upt_private.run_automation_cycle() from public,anon,authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname='uptilldawn-operational-alerts';

select cron.schedule(
  'uptilldawn-operational-alerts',
  '* * * * *',
  'select upt_private.run_automation_cycle()'
);

notify pgrst,'reload schema';
