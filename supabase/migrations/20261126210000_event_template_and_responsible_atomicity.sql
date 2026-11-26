-- Keep forced event closure consistent with the original retention-window rule
-- and the existing end_at > start_at invariant. No backdating or constraint bypass.
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
  v_start timestamptz;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan een evenement afsluiten.'; end if;
  select end_at,start_at into v_end,v_start from public.events where id=p_event for update;
  if v_end is null then raise exception 'Evenement niet gevonden.'; end if;
  -- A future event cannot have an actual end before its scheduled start.
  if now()<=v_start then raise exception 'Een evenement dat nog niet gestart is kan niet worden afgesloten.'; end if;
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

-- Event creation automatically seeds catalog workposts and inventory. Merge captured
-- values onto their existing rows rather than duplicating the catalog identities.
create or replace function public.upt_apply_event_template(
  p_template uuid,
  p_name text,
  p_start timestamptz,
  p_end timestamptz,
  p_venue text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_config jsonb;
  v_event uuid;
  v_row jsonb;
  v_item jsonb;
  v_new_workplace uuid;
  v_new_checklist uuid;
  v_map jsonb:='{}'::jsonb;
  v_old text;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan eventtemplates toepassen.';
  end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200 then
    raise exception 'Geef een evenementnaam.';
  end if;
  if p_start is null or p_end is null or p_end<=p_start then
    raise exception 'Ongeldige evenementuren.';
  end if;

  select configuration into v_config from public.event_templates where id=p_template;
  if v_config is null then raise exception 'Template niet gevonden.'; end if;

  insert into public.events(name,venue,address,start_at,end_at,start_date,end_date,created_by)
  values(
    trim(p_name),nullif(trim(coalesce(p_venue,'')),''),nullif(trim(coalesce(p_address,'')),''),
    p_start,p_end,p_start,p_end,v_actor
  )
  returning id into v_event;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'workplaces','[]'::jsonb))
  loop
    insert into public.workplaces(
      event_id,name,description,sort_order,is_active,minimum_staff,target_staff,maximum_staff,map_x,map_y,map_label
    )
    values(
      v_event,trim(v_row->>'name'),nullif(v_row->>'description',''),
      coalesce((v_row->>'sortOrder')::integer,0),true,
      coalesce((v_row->>'minimumStaff')::integer,0),
      coalesce((v_row->>'targetStaff')::integer,0),
      nullif(v_row->>'maximumStaff','')::integer,
      nullif(v_row->>'mapX','')::numeric,nullif(v_row->>'mapY','')::numeric,nullif(v_row->>'mapLabel','')
    )
    on conflict(event_id,name) do update set
      description=excluded.description,sort_order=excluded.sort_order,
      is_active=excluded.is_active,minimum_staff=excluded.minimum_staff,
      target_staff=excluded.target_staff,maximum_staff=excluded.maximum_staff,
      map_x=excluded.map_x,map_y=excluded.map_y,map_label=excluded.map_label
    returning id into v_new_workplace;
    v_map:=v_map||jsonb_build_object(v_row->>'sourceId',v_new_workplace);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'briefings','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplaceId','');
    insert into public.briefings(event_id,workplace_id,title,body,required,created_by)
    values(
      v_event,
      case when v_old is null then null else (v_map->>v_old)::uuid end,
      v_row->>'title',v_row->>'body',coalesce((v_row->>'required')::boolean,true),v_actor
    );
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'tasks','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplaceId','');
    insert into public.tasks(event_id,workplace_id,title,description,created_by)
    values(
      v_event,
      case when v_old is null then null else (v_map->>v_old)::uuid end,
      v_row->>'title',nullif(v_row->>'description',''),v_actor
    );
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'checklists','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplaceId','');
    if v_old is not null and v_map ? v_old then
      insert into public.operational_checklists(event_id,workplace_id,kind,title,description,status,created_by)
      values(
        v_event,(v_map->>v_old)::uuid,v_row->>'kind',v_row->>'title',
        nullif(v_row->>'description',''),'open',v_actor
      )
      returning id into v_new_checklist;

      for v_item in select * from jsonb_array_elements(coalesce(v_row->'items','[]'::jsonb))
      loop
        insert into public.checklist_items(checklist_id,label,required,requires_photo,sort_order)
        values(
          v_new_checklist,v_item->>'label',
          coalesce((v_item->>'required')::boolean,true),
          coalesce((v_item->>'requiresPhoto')::boolean,false),
          coalesce((v_item->>'sortOrder')::integer,0)
        );
      end loop;
    end if;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'inventory','[]'::jsonb))
  loop
    v_old:=nullif(v_row->>'workplaceId','');
    if v_old is not null and v_map ? v_old then
      insert into public.inventory_items(
        event_id,workplace_id,name,category,total_quantity,available_quantity,reorder_threshold,
        unit_cost_cents,location_label,asset_notes,created_by
      )
      values(
        v_event,(v_map->>v_old)::uuid,v_row->>'name',nullif(v_row->>'category',''),
        greatest(0,coalesce((v_row->>'totalQuantity')::integer,0)),
        greatest(0,coalesce((v_row->>'totalQuantity')::integer,0)),
        greatest(0,coalesce((v_row->>'reorderThreshold')::integer,0)),
        nullif(v_row->>'unitCostCents','')::integer,nullif(v_row->>'locationLabel',''),
        nullif(v_row->>'assetNotes',''),v_actor
      )
      on conflict(workplace_id,lower(name)) where is_active=true do update set
        category=excluded.category,total_quantity=excluded.total_quantity,
        available_quantity=excluded.available_quantity,reorder_threshold=excluded.reorder_threshold,
        unit_cost_cents=excluded.unit_cost_cents,location_label=excluded.location_label,
        asset_notes=excluded.asset_notes,updated_at=now();
    end if;
  end loop;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.template.applied','event',v_event,jsonb_build_object('template_id',p_template));

  return v_event;
end;
$fn$;

revoke all on function public.upt_apply_event_template(uuid,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.upt_apply_event_template(uuid,text,timestamptz,timestamptz,text,text) to authenticated;

notify pgrst,'reload schema';


-- Admin-only, atomic counterpart to the old multi-request assignment flow.
-- Authenticated callers retain no direct profile-table grants. Existing role RPC
-- continues to enforce protected Maker and leadership rules.
CREATE OR REPLACE FUNCTION public.upt_admin_set_responsible_assignment(
 p_workplace uuid,p_user uuid,p_assign boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public'
AS $responsible$
DECLARE
 v_actor uuid:=auth.uid();
 v_role text;
 v_approved boolean;
 v_event uuid;
 v_active boolean;
BEGIN
 IF v_actor IS NULL OR NOT public.upt_is_approved() OR NOT public.upt_is_admin(v_actor)
 THEN RAISE EXCEPTION 'Admin vereist' USING ERRCODE='42501'; END IF;
 IF p_workplace IS NULL OR p_user IS NULL OR p_assign IS NULL
 THEN RAISE EXCEPTION 'Ongeldige toewijzing' USING ERRCODE='22023'; END IF;
 -- Serialize assignment/demotion for this person, including overlapping posts.
 SELECT role,approved INTO v_role,v_approved
 FROM public.profiles WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Personeelslid niet gevonden'; END IF;
 SELECT event_id,is_active INTO v_event,v_active FROM public.workplaces
 WHERE id=p_workplace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Werkplek niet gevonden'; END IF;
 IF p_assign THEN
  IF NOT v_active OR NOT v_approved OR NOT EXISTS(
   SELECT 1 FROM public.shifts s WHERE s.workplace_id=p_workplace
    AND s.event_id=v_event AND s.user_id=p_user
    AND s.status<>'cancelled' AND s.response_status<>'declined'
  ) THEN RAISE EXCEPTION 'Geen geldige dienst op deze werkplek'; END IF;
  IF EXISTS(
   SELECT 1 FROM public.shifts candidate
   JOIN public.responsible_assignments r ON r.user_id=p_user AND r.workplace_id<>p_workplace
   JOIN public.shifts existing ON existing.user_id=p_user AND existing.workplace_id=r.workplace_id
   WHERE candidate.workplace_id=p_workplace AND candidate.user_id=p_user
     AND candidate.status<>'cancelled' AND candidate.response_status<>'declined'
     AND existing.status<>'cancelled' AND existing.response_status<>'declined'
     AND candidate.scheduled_start<existing.scheduled_end
     AND candidate.scheduled_end>existing.scheduled_start
  ) THEN RAISE EXCEPTION 'Deze persoon is al verantwoordelijk op een andere werkplek'; END IF;
  IF v_role='staff' THEN
   PERFORM public.upt_admin_set_account(p_user,true,'responsible_lead');
  END IF;
  INSERT INTO public.event_members(event_id,user_id,event_role)
  VALUES(v_event,p_user,CASE WHEN v_role='admin' THEN 'admin' ELSE 'responsible_lead' END)
  ON CONFLICT(event_id,user_id) DO UPDATE SET event_role=excluded.event_role;
  INSERT INTO public.responsible_assignments(event_id,workplace_id,user_id,assigned_by)
  VALUES(v_event,p_workplace,p_user,v_actor)
  ON CONFLICT(workplace_id,user_id) DO UPDATE SET assigned_by=excluded.assigned_by;
 ELSE
  IF v_role='admin' THEN RAISE EXCEPTION 'Een beheerder kan niet worden omgezet'; END IF;
  DELETE FROM public.responsible_assignments WHERE workplace_id=p_workplace AND user_id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Toewijzing niet gevonden'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.responsible_assignments WHERE event_id=v_event AND user_id=p_user) THEN
   UPDATE public.event_members SET event_role='employee'
   WHERE event_id=v_event AND user_id=p_user AND event_role='responsible_lead';
  END IF;
  IF v_role='responsible_lead' AND NOT EXISTS(
   SELECT 1 FROM public.responsible_assignments WHERE user_id=p_user
  ) THEN
   PERFORM public.upt_admin_set_account(p_user,v_approved,'staff');
   UPDATE public.event_members SET event_role='employee' WHERE user_id=p_user AND event_role='responsible_lead';
  END IF;
 END IF;
 INSERT INTO public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 VALUES(v_actor,CASE WHEN p_assign THEN 'responsible.assigned' ELSE 'responsible.demoted' END,
 'workplace',p_workplace,jsonb_build_object('user_id',p_user,'event_id',v_event));
END;
$responsible$;
REVOKE ALL ON FUNCTION public.upt_admin_set_responsible_assignment(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upt_admin_set_responsible_assignment(uuid,uuid,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
