-- Transactional event template capture/apply workflow.

create or replace function public.upt_capture_event_template(
  p_event uuid,
  p_name text,
  p_sections text[] default array['workplaces','briefing','tasks','checklists','inventory']
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $fn$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_config jsonb;
  v_allowed constant text[]:=array['workplaces','briefing','tasks','checklists','inventory'];
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then
    raise exception 'Alleen admin kan eventtemplates beheren.';
  end if;
  if p_name is null or length(trim(p_name)) not between 3 and 200 then
    raise exception 'Geef een geldige templatenaam.';
  end if;
  if not exists(select 1 from public.events where id=p_event) then
    raise exception 'Evenement niet gevonden.';
  end if;
  if p_sections is null or cardinality(p_sections)=0
     or exists(select 1 from unnest(p_sections) x where not (x=any(v_allowed))) then
    raise exception 'Ongeldige templateselectie.';
  end if;

  select jsonb_build_object(
    'version',3,
    'sourceEventId',p_event,
    'capturedAt',now(),
    'workplaces',case when 'workplaces'=any(p_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId',w.id,'name',w.name,'description',w.description,'sortOrder',w.sort_order,
        'minimumStaff',w.minimum_staff,'targetStaff',w.target_staff,'maximumStaff',w.maximum_staff,
        'mapX',w.map_x,'mapY',w.map_y,'mapLabel',w.map_label
      ) order by w.sort_order,w.name)
      from public.workplaces w where w.event_id=p_event and w.is_active=true
    ),'[]'::jsonb) else '[]'::jsonb end,
    'briefings',case when 'briefing'=any(p_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplaceId',b.workplace_id,'title',b.title,'body',b.body,'required',b.required
      ) order by b.created_at)
      from public.briefings b where b.event_id=p_event
    ),'[]'::jsonb) else '[]'::jsonb end,
    'tasks',case when 'tasks'=any(p_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplaceId',t.workplace_id,'title',t.title,'description',t.description
      ) order by t.created_at)
      from public.tasks t where t.event_id=p_event
    ),'[]'::jsonb) else '[]'::jsonb end,
    'checklists',case when 'checklists'=any(p_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId',c.id,'workplaceId',c.workplace_id,'kind',c.kind,'title',c.title,'description',c.description,
        'items',coalesce((
          select jsonb_agg(jsonb_build_object(
            'label',ci.label,'required',ci.required,'requiresPhoto',ci.requires_photo,'sortOrder',ci.sort_order
          ) order by ci.sort_order,ci.created_at)
          from public.checklist_items ci where ci.checklist_id=c.id
        ),'[]'::jsonb)
      ) order by c.created_at)
      from public.operational_checklists c where c.event_id=p_event
    ),'[]'::jsonb) else '[]'::jsonb end,
    'inventory',case when 'inventory'=any(p_sections) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplaceId',i.workplace_id,'name',i.name,'category',i.category,'totalQuantity',i.total_quantity,
        'reorderThreshold',i.reorder_threshold,'unitCostCents',i.unit_cost_cents,'locationLabel',i.location_label,
        'assetNotes',i.asset_notes
      ) order by i.category,i.name)
      from public.inventory_items i where i.event_id=p_event and i.is_active=true
    ),'[]'::jsonb) else '[]'::jsonb end
  ) into v_config;

  insert into public.event_templates(name,configuration,created_by,source_event_id,sections,updated_at)
  values(trim(p_name),v_config,v_actor,p_event,p_sections,now())
  returning id into v_id;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'event.template.captured','event_template',v_id,jsonb_build_object('event_id',p_event,'sections',p_sections));

  return v_id;
end;
$fn$;

revoke all on function public.upt_capture_event_template(uuid,text,text[]) from public,anon;
grant execute on function public.upt_capture_event_template(uuid,text,text[]) to authenticated;

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
      );
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
