-- Closing an event is the authoritative operational end. Start post-event retention immediately.
create or replace function public.upt_close_event(
  p_event uuid,p_force boolean default false,p_reason text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_blockers text[]:=array[]::text[];
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_end timestamptz;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement afsluiten.'; end if;
  select end_at into v_end from public.events where id=p_event;
  if v_end is null then raise exception 'Evenement niet gevonden.'; end if;
  if now()<v_end then v_blockers:=array_append(v_blockers,'evenement is nog niet afgelopen'); end if;
  if exists(select 1 from public.work_sessions ws where ws.event_id=p_event and ws.ended_at is null) then v_blockers:=array_append(v_blockers,'actieve werkuren'); end if;
  if exists(select 1 from public.operational_checklists c where c.event_id=p_event and c.kind='closing' and c.status<>'completed') then v_blockers:=array_append(v_blockers,'onvoltooide sluitchecklists'); end if;
  if exists(select 1 from public.incidents i where i.event_id=p_event and coalesce(i.status,'')<>'resolved' and i.resolved_at is null) then v_blockers:=array_append(v_blockers,'open incidenten'); end if;
  if exists(select 1 from public.inventory_items i where i.event_id=p_event and i.is_active=true and (i.missing_quantity>0 or i.damaged_quantity>0)) then v_blockers:=array_append(v_blockers,'inventory-afwijkingen'); end if;
  if cardinality(v_blockers)>0 and not p_force then raise exception 'Evenement kan nog niet worden afgesloten: %',array_to_string(v_blockers,', '); end if;
  if p_force and cardinality(v_blockers)>0 and (v_reason is null or length(v_reason)<5) then raise exception 'Geef een reden voor geforceerd afsluiten.'; end if;
  update public.events
     set status='closed', end_at=least(end_at,now()), end_date=least(coalesce(end_date,end_at),now()), updated_at=now()
   where id=p_event;
  if not found then raise exception 'Evenement niet gevonden.'; end if;
  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.closed','event',p_event,jsonb_build_object('forced',p_force,'reason',v_reason,'blockers',v_blockers,'scheduledEnd',v_end,'closedAt',now()));
end;
$$;
revoke all on function public.upt_close_event(uuid,boolean,text) from public,anon;
grant execute on function public.upt_close_event(uuid,boolean,text) to authenticated;
notify pgrst,'reload schema';
