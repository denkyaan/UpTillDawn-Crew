create or replace function upt_private.refresh_data_anomalies()
returns integer
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_row record;
  v_alert uuid;
  v_created integer:=0;
begin
  create temporary table if not exists pg_temp.upt_current_anomalies(
    dedupe_key text primary key,
    event_id uuid,
    workplace_id uuid,
    user_id uuid,
    metadata jsonb
  ) on commit drop;
  truncate pg_temp.upt_current_anomalies;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:inventory-negative:'||i.id::text,
    i.event_id,i.workplace_id,null::uuid,
    jsonb_build_object('subtype','inventory_negative','item_id',i.id,'item_name',i.name,'message','Inventory bevat een negatieve hoeveelheid voor '||i.name||'.','link','/inventory')
  from public.inventory_items i
  join public.events e on e.id=i.event_id
  where i.is_active=true and coalesce(e.status,'')<>'archived'
    and (i.total_quantity<0 or i.available_quantity<0 or i.issued_quantity<0 or i.damaged_quantity<0 or i.missing_quantity<0)
  on conflict do nothing;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:active-briefing:'||ws.id::text,
    ws.event_id,s.workplace_id,ws.user_id,
    jsonb_build_object('subtype','active_briefing_unread','session_id',ws.id,'message','Een medewerker is actief aan het werk zonder alle verplichte briefings bevestigd te hebben.','link','/briefings')
  from public.work_sessions ws
  join public.shifts s on s.id=ws.shift_id
  where ws.ended_at is null
    and exists(
      select 1 from public.briefings b
      where b.event_id=ws.event_id and b.required=true
        and (b.workplace_id is null or b.workplace_id=s.workplace_id)
        and not exists(
          select 1 from public.briefing_acknowledgements ba
          where ba.briefing_id=b.id and ba.user_id=ws.user_id and ba.version=b.version
        )
    )
  on conflict do nothing;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:overlapping-sessions:'||ws.user_id::text,
    min(ws.event_id::text)::uuid,null::uuid,ws.user_id,
    jsonb_build_object('subtype','overlapping_active_sessions','active_sessions',count(*),'message','Een medewerker heeft meerdere actieve werksessies tegelijk.','link','/admin/time-records')
  from public.work_sessions ws
  where ws.ended_at is null
  group by ws.user_id
  having count(*)>1
  on conflict do nothing;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:guest-overcheck:'||g.id::text,
    g.event_id,null::uuid,null::uuid,
    jsonb_build_object('subtype','guestlist_overcheck','entry_id',g.id,'name',g.name,'message','Een guestlist-entry heeft meer check-ins dan beschikbare spots.','link','/guestlist')
  from public.event_guestlist_entries g
  join public.events e on e.id=g.event_id
  where g.is_active=true and coalesce(e.status,'')<>'archived' and g.spots_checked_in>g.spots_total
  on conflict do nothing;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:sales-total:'||st.id::text,
    st.event_id,st.workplace_id,st.seller_id,
    jsonb_build_object('subtype','sales_total_mismatch','transaction_id',st.id,'message','Een sales-transactie heeft een totaal dat niet overeenkomt met prijs × aantal.','link','/sales')
  from public.sales_transactions st
  join public.events e on e.id=st.event_id
  where coalesce(e.status,'')<>'archived'
    and abs(st.total_cents-(st.unit_price_cents::bigint*st.quantity::bigint))>0
  on conflict do nothing;

  insert into pg_temp.upt_current_anomalies(dedupe_key,event_id,workplace_id,user_id,metadata)
  select
    'data-anomaly:sale-inactive-item:'||st.id::text,
    st.event_id,st.workplace_id,st.seller_id,
    jsonb_build_object('subtype','sale_without_active_inventory','transaction_id',st.id,'item_id',st.inventory_item_id,'message','Een verkoop verwijst naar inventory die niet meer actief is.','link','/sales')
  from public.sales_transactions st
  join public.inventory_items i on i.id=st.inventory_item_id
  join public.events e on e.id=st.event_id
  where coalesce(e.status,'')<>'archived' and st.transaction_type='sale' and i.is_active=false
  on conflict do nothing;

  update upt_private.operational_alerts a
  set resolved_at=now()
  where a.kind='data-anomaly' and a.resolved_at is null
    and not exists(select 1 from pg_temp.upt_current_anomalies ca where ca.dedupe_key=a.dedupe_key);

  for v_row in select * from pg_temp.upt_current_anomalies
  loop
    v_alert:=null;
    select id into v_alert from upt_private.operational_alerts
    where dedupe_key=v_row.dedupe_key and resolved_at is null limit 1;

    if v_alert is null then
      insert into upt_private.operational_alerts(event_id,workplace_id,user_id,kind,dedupe_key,metadata)
      values(v_row.event_id,v_row.workplace_id,v_row.user_id,'data-anomaly',v_row.dedupe_key,v_row.metadata)
      returning id into v_alert;
      v_created:=v_created+1;
    else
      update upt_private.operational_alerts set metadata=v_row.metadata where id=v_alert;
    end if;

    perform upt_private.notify_platform_alert(v_alert);
  end loop;

  return v_created;
end;
$$;
notify pgrst,'reload schema';
