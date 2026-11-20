create or replace function upt_private.notify_platform_alert(p_alert uuid)
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_alert upt_private.operational_alerts%rowtype;
  v_target record;
  v_title text;
  v_body text;
  v_link text;
  v_query text;
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
    when 'data-anomaly' then 'Dataconsistentie waarschuwing'
    else 'Operationele waarschuwing'
  end;

  v_body:=case v_alert.kind
    when 'responsible-missing' then 'Een actieve werkplek heeft geen toegewezen verantwoordelijke.'
    when 'briefing-unread' then 'Een verplichte briefing is nog niet bevestigd voor een aankomende dienst.'
    when 'inventory-low' then 'De beschikbare voorraad heeft het ingestelde minimum bereikt.'
    when 'checklist-overdue' then 'Een operationele checklist is na het geplande moment nog open.'
    when 'data-anomaly' then coalesce(v_alert.metadata->>'message','Er is een inconsistentie gevonden die nagekeken moet worden.')
    else 'Bekijk het command center voor details.'
  end;

  v_query:='?event='||v_alert.event_id::text
    ||case when v_alert.workplace_id is not null then '&workplace='||v_alert.workplace_id::text else '' end
    ||case when v_alert.user_id is not null then '&user='||v_alert.user_id::text else '' end
    ||'&focus='||v_alert.kind;

  v_link:=case v_alert.kind
    when 'responsible-missing' then '/workplaces'||v_query
    when 'briefing-unread' then '/briefings'||v_query
    when 'inventory-low' then '/inventory'||v_query
    when 'checklist-overdue' then '/briefings'||v_query
    when 'data-anomaly' then coalesce(v_alert.metadata->>'link','/admin?focus=data-anomaly')
    else '/operations'||v_query
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
        and v_alert.kind in('briefing-unread','inventory-low','checklist-overdue','data-anomaly')
      union
      select p.id
      from public.profiles p
      where p.approved=true
        and p.role='admin'
        and v_alert.kind in('responsible-missing','inventory-low','checklist-overdue','data-anomaly')
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
$$;

revoke all on function upt_private.notify_platform_alert(uuid) from public,anon,authenticated;

notify pgrst,'reload schema';
