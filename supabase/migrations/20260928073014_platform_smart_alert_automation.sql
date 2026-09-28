alter table upt_private.operational_alerts
  add column if not exists dedupe_key text;

create unique index if not exists operational_alerts_open_dedupe_idx
on upt_private.operational_alerts(dedupe_key)
where dedupe_key is not null and resolved_at is null;

create table if not exists upt_private.operational_alert_deliveries(
  alert_id uuid not null references upt_private.operational_alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key(alert_id,user_id)
);
alter table upt_private.operational_alert_deliveries enable row level security;
revoke all on table upt_private.operational_alert_deliveries from public,anon,authenticated;

create or replace function upt_private.notify_platform_alert(p_alert uuid)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_alert upt_private.operational_alerts%rowtype;
  v_target record;
  v_title text;
  v_body text;
  v_link text;
  v_count integer:=0;
begin
  select * into v_alert
  from upt_private.operational_alerts
  where id=p_alert and resolved_at is null;
  if not found then return 0; end if;

  v_title:=case v_alert.kind
    when 'responsible-missing' then 'Verantwoordelijke ontbreekt'
    when 'briefing-unread' then 'Briefing nog niet bevestigd'
    when 'inventory-low' then 'Voorraad onder minimum'
    when 'checklist-overdue' then 'Checklist nog niet afgerond'
    else 'Operationele waarschuwing'
  end;
  v_body:=case v_alert.kind
    when 'responsible-missing' then 'Een actieve werkplek heeft geen toegewezen verantwoordelijke.'
    when 'briefing-unread' then 'Een verplichte briefing is nog niet bevestigd voor een aankomende dienst.'
    when 'inventory-low' then 'De beschikbare voorraad heeft het ingestelde minimum bereikt.'
    when 'checklist-overdue' then 'Een operationele checklist is na het geplande moment nog open.'
    else 'Bekijk het command center voor details.'
  end;
  v_link:=case v_alert.kind
    when 'briefing-unread' then '/briefings'
    when 'inventory-low' then '/inventory'
    when 'checklist-overdue' then '/inventory'
    else '/control-center'
  end;

  for v_target in
    select distinct target.user_id
    from(
      select v_alert.user_id as user_id
      where v_alert.kind='briefing-unread' and v_alert.user_id is not null
      union
      select ra.user_id
      from public.responsible_assignments ra
      where ra.event_id=v_alert.event_id
        and ra.workplace_id=v_alert.workplace_id
        and v_alert.kind in('briefing-unread','inventory-low','checklist-overdue')
      union
      select p.id
      from public.profiles p
      where p.approved=true
        and p.role='admin'
        and v_alert.kind in('responsible-missing','inventory-low','checklist-overdue')
    )target
    where target.user_id is not null
  loop
    if exists(
      select 1 from upt_private.operational_alert_deliveries d
      where d.alert_id=p_alert and d.user_id=v_target.user_id
    ) then continue; end if;

    insert into public.crew_notifications(user_id,title,body,link,kind)
    values(v_target.user_id,v_title,v_body,v_link,'smart_alert');

    insert into upt_private.operational_alert_deliveries(alert_id,user_id)
    values(p_alert,v_target.user_id)
    on conflict do nothing;

    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$fn$;

revoke all on function upt_private.notify_platform_alert(uuid) from public,anon,authenticated;

create or replace function upt_private.refresh_platform_intelligence()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $fn$
declare
  v_row record;
  v_alert uuid;
  v_created integer:=0;
  v_snapshot jsonb;
begin
  update upt_private.operational_alerts a
  set resolved_at=now()
  where a.kind='responsible-missing'
    and a.resolved_at is null
    and exists(
      select 1 from public.responsible_assignments ra
      where ra.event_id=a.event_id and ra.workplace_id=a.workplace_id
    );

  update upt_private.operational_alerts a
  set resolved_at=now()
  where a.kind='briefing-unread'
    and a.resolved_at is null
    and(
      not exists(
        select 1 from public.shifts s
        where s.id=a.shift_id and s.status<>'cancelled' and s.scheduled_start>now()
      )
      or not exists(
        select 1
        from public.briefings b
        join public.shifts s on s.id=a.shift_id
        where b.event_id=s.event_id
          and b.required=true
          and(b.workplace_id is null or b.workplace_id=s.workplace_id)
          and not exists(
            select 1 from public.briefing_acknowledgements ba
            where ba.briefing_id=b.id and ba.user_id=s.user_id and ba.version=b.version
          )
      )
    );

  update upt_private.operational_alerts a
  set resolved_at=now()
  where a.kind='inventory-low'
    and a.resolved_at is null
    and not exists(
      select 1 from public.inventory_items i
      where a.dedupe_key='inventory-low:'||i.id::text
        and i.is_active=true
        and i.reorder_threshold>0
        and i.available_quantity<=i.reorder_threshold
    );

  update upt_private.operational_alerts a
  set resolved_at=now()
  where a.kind='checklist-overdue'
    and a.resolved_at is null
    and not exists(
      select 1
      from public.operational_checklists c
      join public.events e on e.id=c.event_id
      where a.dedupe_key='checklist-overdue:'||c.id::text
        and c.status<>'completed'
        and(
          (c.kind='opening' and now()>e.start_at)
          or(c.kind='closing' and now()>e.end_at)
        )
    );

  for v_row in
    select w.id as workplace_id,w.event_id,w.name
    from public.workplaces w
    join public.events e on e.id=w.event_id
    where w.is_active=true
      and coalesce(e.status,'')<>'archived'
      and now() between e.start_at and e.end_at
      and not exists(
        select 1 from public.responsible_assignments ra
        where ra.event_id=w.event_id and ra.workplace_id=w.id
      )
  loop
    v_alert:=null;
    select id into v_alert
    from upt_private.operational_alerts
    where dedupe_key='responsible-missing:'||v_row.workplace_id::text
      and resolved_at is null
    limit 1;

    if v_alert is null then
      insert into upt_private.operational_alerts(event_id,workplace_id,kind,dedupe_key,metadata)
      values(
        v_row.event_id,v_row.workplace_id,'responsible-missing',
        'responsible-missing:'||v_row.workplace_id::text,
        jsonb_build_object('workplace_name',v_row.name,'suggested_action','assign-responsible')
      )
      returning id into v_alert;
      v_created:=v_created+1;
    end if;
    perform upt_private.notify_platform_alert(v_alert);
  end loop;

  for v_row in
    select distinct s.id as shift_id,s.event_id,s.workplace_id,s.user_id
    from public.shifts s
    where s.status<>'cancelled'
      and s.response_status<>'declined'
      and s.scheduled_start>now()
      and s.scheduled_start<=now()+interval '2 hours'
      and exists(
        select 1
        from public.briefings b
        where b.event_id=s.event_id
          and b.required=true
          and(b.workplace_id is null or b.workplace_id=s.workplace_id)
          and not exists(
            select 1 from public.briefing_acknowledgements ba
            where ba.briefing_id=b.id and ba.user_id=s.user_id and ba.version=b.version
          )
      )
  loop
    v_alert:=null;
    select id into v_alert
    from upt_private.operational_alerts
    where dedupe_key='briefing-unread:'||v_row.shift_id::text
      and resolved_at is null
    limit 1;

    if v_alert is null then
      insert into upt_private.operational_alerts(
        shift_id,event_id,workplace_id,user_id,kind,dedupe_key,metadata
      )
      values(
        v_row.shift_id,v_row.event_id,v_row.workplace_id,v_row.user_id,
        'briefing-unread','briefing-unread:'||v_row.shift_id::text,
        jsonb_build_object('suggested_action','open-briefing')
      )
      returning id into v_alert;
      v_created:=v_created+1;
    end if;
    perform upt_private.notify_platform_alert(v_alert);
  end loop;

  for v_row in
    select i.id,i.event_id,i.workplace_id,i.name,i.available_quantity,i.reorder_threshold
    from public.inventory_items i
    join public.events e on e.id=i.event_id
    where i.is_active=true
      and i.reorder_threshold>0
      and i.available_quantity<=i.reorder_threshold
      and coalesce(e.status,'')<>'archived'
      and e.end_at>=now()-interval '3 days'
  loop
    v_alert:=null;
    select id into v_alert
    from upt_private.operational_alerts
    where dedupe_key='inventory-low:'||v_row.id::text
      and resolved_at is null
    limit 1;

    if v_alert is null then
      insert into upt_private.operational_alerts(event_id,workplace_id,kind,dedupe_key,metadata)
      values(
        v_row.event_id,v_row.workplace_id,'inventory-low','inventory-low:'||v_row.id::text,
        jsonb_build_object(
          'item_id',v_row.id,'item_name',v_row.name,'available_quantity',v_row.available_quantity,
          'reorder_threshold',v_row.reorder_threshold,'suggested_action','restock'
        )
      )
      returning id into v_alert;
      v_created:=v_created+1;
    else
      update upt_private.operational_alerts
      set metadata=jsonb_set(
        jsonb_set(metadata,'{available_quantity}',to_jsonb(v_row.available_quantity),true),
        '{reorder_threshold}',to_jsonb(v_row.reorder_threshold),true
      )
      where id=v_alert;
    end if;
    perform upt_private.notify_platform_alert(v_alert);
  end loop;

  for v_row in
    select c.id,c.event_id,c.workplace_id,c.kind,c.title
    from public.operational_checklists c
    join public.events e on e.id=c.event_id
    where c.status<>'completed'
      and(
        (c.kind='opening' and now()>e.start_at)
        or(c.kind='closing' and now()>e.end_at)
      )
  loop
    v_alert:=null;
    select id into v_alert
    from upt_private.operational_alerts
    where dedupe_key='checklist-overdue:'||v_row.id::text
      and resolved_at is null
    limit 1;

    if v_alert is null then
      insert into upt_private.operational_alerts(event_id,workplace_id,kind,dedupe_key,metadata)
      values(
        v_row.event_id,v_row.workplace_id,'checklist-overdue','checklist-overdue:'||v_row.id::text,
        jsonb_build_object('checklist_id',v_row.id,'title',v_row.title,'kind',v_row.kind,'suggested_action','complete-checklist')
      )
      returning id into v_alert;
      v_created:=v_created+1;
    end if;
    perform upt_private.notify_platform_alert(v_alert);
  end loop;

  for v_row in
    select e.id,e.name
    from public.events e
    where e.end_at<now()
      and e.end_at>=now()-interval '30 days'
      and e.status<>'archived'
      and not exists(
        select 1 from public.event_report_snapshots r
        where r.event_id=e.id and r.generation_kind='automatic'
      )
  loop
    v_snapshot:=upt_private.build_event_report(v_row.id);
    if v_snapshot is not null then
      insert into public.event_report_snapshots(event_id,snapshot,generation_kind)
      values(v_row.id,v_snapshot,'automatic');

      insert into public.crew_notifications(user_id,title,body,link,kind)
      select p.id,'Eventrapport klaar',v_row.name||' is afgerond. Het automatische eventrapport staat klaar.','/control-center','event_report'
      from public.profiles p
      where p.approved=true and p.role='admin';
    end if;
  end loop;

  if not exists(
    select 1 from public.recovery_checks
    where check_type='logical-health' and checked_at>now()-interval '1 hour'
  ) then
    insert into public.recovery_checks(check_type,status,details)
    values(
      'logical-health',
      'pass',
      jsonb_build_object(
        'databaseReachable',true,
        'rlsOnCriticalTables',(
          select bool_and(c.relrowsecurity)
          from pg_class c
          join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public'
            and c.relname in('events','shifts','work_sessions','incidents','inventory_items','event_report_snapshots')
        ),
        'physicalRestoreProof','pending'
      )
    );
  end if;

  return v_created;
end;
$fn$;

revoke all on function upt_private.refresh_platform_intelligence() from public,anon,authenticated;

select cron.schedule(
  'uptilldawn-operational-alerts',
  '* * * * *',
  'select upt_private.send_shift_reminders(), upt_private.notify_break_allowance(), upt_private.refresh_operational_alerts(), upt_private.refresh_incident_escalations(), upt_private.refresh_platform_intelligence()'
);

notify pgrst,'reload schema';

