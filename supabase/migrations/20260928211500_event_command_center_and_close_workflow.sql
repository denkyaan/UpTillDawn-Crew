alter table public.inventory_items
  add column if not exists item_kind text not null default 'consumable'
  check (item_kind in ('asset','consumable'));

create index if not exists inventory_items_item_kind_idx
  on public.inventory_items(event_id,workplace_id,item_kind);

create or replace function public.upt_event_command_snapshot(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid(); v_result jsonb;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if not public.upt_is_admin(v_actor)
     and not exists(select 1 from public.event_members em where em.event_id=p_event and em.user_id=v_actor)
     and not public.upt_is_responsible(p_event,null,v_actor) then raise exception 'Geen toegang.'; end if;

  select jsonb_build_object(
    'event',jsonb_build_object('id',e.id,'name',e.name,'status',e.status,'startAt',e.start_at,'endAt',e.end_at,'registrationDeadline',e.registration_deadline,'maxJoiners',e.max_joiners),
    'staffing',jsonb_build_object(
      'workplaces',(select count(*) from public.workplaces w where w.event_id=e.id and w.is_active=true),
      'responsibles',(select count(distinct ra.workplace_id) from public.responsible_assignments ra where ra.event_id=e.id),
      'targetStaff',coalesce((select sum(w.target_staff) from public.workplaces w where w.event_id=e.id and w.is_active=true),0),
      'scheduledCrew',(select count(distinct s.user_id) from public.shifts s where s.event_id=e.id and coalesce(s.status,'')<>'cancelled' and coalesce(s.response_status,'')<>'declined'),
      'confirmedMembers',(select count(*) from public.event_members em where em.event_id=e.id),
      'waitlist',(select count(*) from public.event_availability ea where ea.event_id=e.id and ea.response='can' and not exists(select 1 from public.event_members em where em.event_id=ea.event_id and em.user_id=ea.user_id))
    ),
    'briefing',jsonb_build_object('required',(select count(*) from public.briefings b where b.event_id=e.id and b.required=true),'acknowledged',(select count(distinct ba.briefing_id) from public.briefing_acknowledgements ba join public.briefings b on b.id=ba.briefing_id where b.event_id=e.id)),
    'checklists',jsonb_build_object(
      'openingTotal',(select count(*) from public.operational_checklists c where c.event_id=e.id and c.kind='opening'),
      'openingCompleted',(select count(*) from public.operational_checklists c where c.event_id=e.id and c.kind='opening' and c.status='completed'),
      'closingTotal',(select count(*) from public.operational_checklists c where c.event_id=e.id and c.kind='closing'),
      'closingCompleted',(select count(*) from public.operational_checklists c where c.event_id=e.id and c.kind='closing' and c.status='completed')
    ),
    'inventory',jsonb_build_object(
      'items',(select count(*) from public.inventory_items i where i.event_id=e.id and i.is_active=true),
      'lowStock',(select count(*) from public.inventory_items i where i.event_id=e.id and i.is_active=true and i.available_quantity<=i.reorder_threshold),
      'missing',(select coalesce(sum(i.missing_quantity),0) from public.inventory_items i where i.event_id=e.id and i.is_active=true),
      'damaged',(select coalesce(sum(i.damaged_quantity),0) from public.inventory_items i where i.event_id=e.id and i.is_active=true),
      'assets',(select count(*) from public.inventory_items i where i.event_id=e.id and i.is_active=true and i.item_kind='asset'),
      'consumables',(select count(*) from public.inventory_items i where i.event_id=e.id and i.is_active=true and i.item_kind='consumable')
    ),
    'operations',jsonb_build_object(
      'openIncidents',(select count(*) from public.incidents i where i.event_id=e.id and coalesce(i.status,'')<>'resolved' and i.resolved_at is null),
      'activeSessions',(select count(*) from public.work_sessions ws where ws.event_id=e.id and ws.ended_at is null),
      'guestlistEntries',(select count(*) from public.event_guestlist_entries ge where ge.event_id=e.id and ge.is_active=true),
      'guestSpots',(select coalesce(sum(ge.spots_total),0) from public.event_guestlist_entries ge where ge.event_id=e.id and ge.is_active=true),
      'guestCheckedIn',(select coalesce(sum(ge.spots_checked_in),0) from public.event_guestlist_entries ge where ge.event_id=e.id and ge.is_active=true)
    ),
    'sales',jsonb_build_object(
      'netCents',coalesce((select sum(case when st.transaction_type='refund' then -st.total_cents else st.total_cents end) from public.sales_transactions st where st.event_id=e.id),0),
      'merchCents',coalesce((select sum(case when st.transaction_type='refund' then -st.total_cents else st.total_cents end) from public.sales_transactions st where st.event_id=e.id and st.sale_category='merch'),0),
      'tokenCents',coalesce((select sum(case when st.transaction_type='refund' then -st.total_cents else st.total_cents end) from public.sales_transactions st where st.event_id=e.id and st.sale_category='token'),0)
    ),
    'readiness',jsonb_build_object(
      'responsiblesReady',not exists(select 1 from public.workplaces w where w.event_id=e.id and w.is_active=true and not exists(select 1 from public.responsible_assignments ra where ra.event_id=e.id and ra.workplace_id=w.id)),
      'staffingReady',coalesce((select count(distinct s.user_id) from public.shifts s where s.event_id=e.id and coalesce(s.status,'')<>'cancelled' and coalesce(s.response_status,'')<>'declined'),0)>=coalesce((select sum(w.minimum_staff) from public.workplaces w where w.event_id=e.id and w.is_active=true),0),
      'briefingReady',not exists(select 1 from public.workplaces w where w.event_id=e.id and w.is_active=true and not exists(select 1 from public.briefings b where b.event_id=e.id and (b.workplace_id=w.id or b.workplace_id is null))),
      'openingReady',not exists(select 1 from public.operational_checklists c where c.event_id=e.id and c.kind='opening' and c.status<>'completed'),
      'inventoryReady',not exists(select 1 from public.inventory_items i where i.event_id=e.id and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0 or i.available_quantity<=i.reorder_threshold)),
      'noOpenIncidents',not exists(select 1 from public.incidents i where i.event_id=e.id and coalesce(i.status,'')<>'resolved' and i.resolved_at is null)
    )
  ) into v_result from public.events e where e.id=p_event;
  if v_result is null then raise exception 'Evenement niet gevonden.'; end if;
  return v_result;
end;
$$;
revoke all on function public.upt_event_command_snapshot(uuid) from public,anon;
grant execute on function public.upt_event_command_snapshot(uuid) to authenticated;

create or replace function public.upt_close_event(p_event uuid,p_force boolean default false,p_reason text default null)
returns void language plpgsql security definer set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid(); v_blockers text[]:=array[]::text[]; v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement afsluiten.'; end if;
 if exists(select 1 from public.work_sessions where event_id=p_event and ended_at is null) then v_blockers:=array_append(v_blockers,'actieve werkuren'); end if;
 if exists(select 1 from public.operational_checklists where event_id=p_event and kind='closing' and status<>'completed') then v_blockers:=array_append(v_blockers,'onvoltooide sluitchecklists'); end if;
 if exists(select 1 from public.incidents where event_id=p_event and coalesce(status,'')<>'resolved' and resolved_at is null) then v_blockers:=array_append(v_blockers,'open incidenten'); end if;
 if exists(select 1 from public.inventory_items where event_id=p_event and is_active=true and (missing_quantity>0 or damaged_quantity>0)) then v_blockers:=array_append(v_blockers,'inventory-afwijkingen'); end if;
 if cardinality(v_blockers)>0 and not p_force then raise exception 'Evenement kan nog niet worden afgesloten: %',array_to_string(v_blockers,', '); end if;
 if p_force and cardinality(v_blockers)>0 and (v_reason is null or length(v_reason)<5) then raise exception 'Geef een reden voor geforceerd afsluiten.'; end if;
 update public.events set status='closed',updated_at=now() where id=p_event;
 if not found then raise exception 'Evenement niet gevonden.'; end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_actor,'event.closed','event',p_event,jsonb_build_object('forced',p_force,'reason',v_reason,'blockers',v_blockers));
end;$$;
revoke all on function public.upt_close_event(uuid,boolean,text) from public,anon;
grant execute on function public.upt_close_event(uuid,boolean,text) to authenticated;

create or replace function public.upt_archive_event(p_event uuid)
returns void language plpgsql security definer set search_path='pg_catalog','public'
as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement archiveren.'; end if;
 if exists(select 1 from public.work_sessions where event_id=p_event and ended_at is null) then raise exception 'Sluit eerst alle actieve werkuren.'; end if;
 update public.events set status='archived',updated_at=now() where id=p_event;
 if not found then raise exception 'Evenement niet gevonden.'; end if;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_actor,'event.archived','event',p_event,'{}'::jsonb);
end;$$;
revoke all on function public.upt_archive_event(uuid) from public,anon;
grant execute on function public.upt_archive_event(uuid) to authenticated;

notify pgrst,'reload schema';
