create or replace function public.upt_event_command_snapshot(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_result jsonb;
begin
  if v_actor is null or not public.upt_is_approved() then
    raise exception 'Aanmelden vereist.';
  end if;
  if not public.upt_is_admin(v_actor)
     and not exists(select 1 from public.event_members em where em.event_id=p_event and em.user_id=v_actor)
     and not public.upt_is_responsible(p_event,null,v_actor) then
    raise exception 'Geen toegang.';
  end if;

  select jsonb_build_object(
    'event',jsonb_build_object(
      'id',e.id,'name',e.name,'status',e.status,'startAt',e.start_at,'endAt',e.end_at,
      'ended',now()>e.end_at,
      'registrationDeadline',e.registration_deadline,'maxJoiners',e.max_joiners
    ),
    'staffing',jsonb_build_object(
      'workplaces',(select count(*) from public.workplaces w where w.event_id=e.id and w.is_active=true),
      'responsibles',(select count(distinct ra.workplace_id) from public.responsible_assignments ra where ra.event_id=e.id),
      'targetStaff',coalesce((select sum(w.target_staff) from public.workplaces w where w.event_id=e.id and w.is_active=true),0),
      'scheduledCrew',(select count(distinct s.user_id) from public.shifts s where s.event_id=e.id and coalesce(s.status,'')<>'cancelled' and coalesce(s.response_status,'')<>'declined'),
      'confirmedMembers',(select count(*) from public.event_members em where em.event_id=e.id),
      'waitlist',(select count(*) from public.event_availability ea where ea.event_id=e.id and ea.response='can' and not exists(select 1 from public.event_members em where em.event_id=ea.event_id and em.user_id=ea.user_id))
    ),
    'briefing',jsonb_build_object(
      'required',(select count(*) from public.briefings b where b.event_id=e.id and b.required=true),
      'acknowledged',(select count(distinct ba.briefing_id) from public.briefing_acknowledgements ba join public.briefings b on b.id=ba.briefing_id where b.event_id=e.id)
    ),
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
    ),
    'closeBlockers',jsonb_build_array(
      case when exists(select 1 from public.work_sessions ws where ws.event_id=e.id and ws.ended_at is null) then 'active_sessions' end,
      case when exists(select 1 from public.operational_checklists c where c.event_id=e.id and c.kind='closing' and c.status<>'completed') then 'closing_checklists' end,
      case when exists(select 1 from public.incidents i where i.event_id=e.id and coalesce(i.status,'')<>'resolved' and i.resolved_at is null) then 'open_incidents' end,
      case when exists(select 1 from public.inventory_items i where i.event_id=e.id and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0)) then 'inventory_exceptions' end
    )
  )
  into v_result
  from public.events e
  where e.id=p_event;

  if v_result is null then raise exception 'Evenement niet gevonden.'; end if;
  return v_result;
end;
$$;
notify pgrst,'reload schema';
