update public.role_ui_rules
set label='Inventaris',
    group_key='navigation',
    visible=true,
    enabled=true,
    condition_key=case when role='admin' then 'always' else 'assigned_workplace_role' end
where feature_key='inventory'
  and role in ('admin','responsible_lead','staff');

create or replace function upt_private.inventory_can_manage(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or (
        public.upt_feature_allowed('inventory',p_event,p_workplace)
        and public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
      )
    ),
    false
  );
$$;

revoke all on function upt_private.inventory_can_manage(uuid,uuid)
from public,anon;
grant execute on function upt_private.inventory_can_manage(uuid,uuid)
to authenticated;

create or replace function upt_private.inventory_can_view(p_event uuid,p_workplace uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
  select coalesce(
    public.upt_is_approved()
    and (
      public.upt_is_admin((select auth.uid()))
      or public.upt_is_responsible(p_event,p_workplace,(select auth.uid()))
      or (
        public.upt_feature_allowed('inventory',p_event,p_workplace)
        and exists(
          select 1
          from public.shifts s
          where s.event_id=p_event
            and s.workplace_id=p_workplace
            and s.user_id=(select auth.uid())
            and s.status<>'cancelled'
            and s.response_status<>'declined'
        )
      )
    ),
    false
  );
$$;

revoke all on function upt_private.inventory_can_view(uuid,uuid)
from public,anon;
grant execute on function upt_private.inventory_can_view(uuid,uuid)
to authenticated;

create or replace function public.upt_create_inventory_item(
  p_workplace uuid,
  p_name text,
  p_category text default null,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_item uuid;
  v_category text:=nullif(trim(coalesce(p_category,'')),'');
  v_admin boolean;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  v_admin:=public.upt_is_admin(v_actor);
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Geef een geldige materiaalnaam.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;

  select w.event_id into v_event
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.id=p_workplace
    and w.is_active=true
    and (
      v_admin
      or (
        coalesce(e.status,'')<>'archived'
        and now()<=e.end_at
      )
    )
  for update of w;
  if not found then raise exception 'Werkplek niet beschikbaar.'; end if;

  if not upt_private.inventory_can_manage(v_event,p_workplace) then
    raise exception 'Geen toegang tot materiaalbeheer op deze werkplek.';
  end if;

  begin
    insert into public.inventory_items(
      event_id,workplace_id,name,category,total_quantity,available_quantity,created_by
    )
    values(v_event,p_workplace,trim(p_name),v_category,p_quantity,p_quantity,v_actor)
    returning id into v_item;
  exception when unique_violation then
    raise exception 'Er bestaat al actief materiaal met deze naam op de werkplek.';
  end;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(v_item,v_event,p_workplace,v_actor,'created',p_quantity,'Initiële voorraad');

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.item.created','inventory_item',v_item,jsonb_build_object(
    'event_id',v_event,'workplace_id',p_workplace,'quantity',p_quantity
  ));

  return v_item;
end;
$function$;

revoke all on function public.upt_create_inventory_item(uuid,text,text,integer)
from public,anon;
grant execute on function public.upt_create_inventory_item(uuid,text,text,integer)
to authenticated;

create or replace function public.upt_report_workplace_inventory_condition(
  p_item uuid,
  p_phase text,
  p_condition text,
  p_quantity integer,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_item public.inventory_items%rowtype;
  v_notes text:=nullif(trim(coalesce(p_notes,'')),'');
  v_phase_label text;
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if p_phase not in ('opening','closing') then raise exception 'Kies opstart of sluiting.'; end if;
  if p_condition not in ('damaged','missing') then raise exception 'Kies kapot of ontbrekend.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;
  if length(coalesce(v_notes,''))>1000 then raise exception 'Notitie is te lang.'; end if;

  select * into v_item
  from public.inventory_items
  where id=p_item
    and is_active=true
  for update;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;

  if not (
    public.upt_is_admin(v_actor)
    or public.upt_is_responsible(v_item.event_id,v_item.workplace_id,v_actor)
  ) then
    raise exception 'Alleen admin of de verantwoordelijke van deze werkplek kan materiaal controleren.';
  end if;

  if p_quantity>v_item.available_quantity then
    raise exception 'Je kunt niet meer melden dan de beschikbare werkplekvoorraad.';
  end if;

  update public.inventory_items
  set available_quantity=available_quantity-p_quantity,
      damaged_quantity=damaged_quantity+case when p_condition='damaged' then p_quantity else 0 end,
      missing_quantity=missing_quantity+case when p_condition='missing' then p_quantity else 0 end,
      updated_at=now()
  where id=v_item.id;

  v_phase_label:=case when p_phase='opening' then 'OPSTART' else 'SLUITING' end;

  insert into public.inventory_movements(
    item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes
  )
  values(
    v_item.id,
    v_item.event_id,
    v_item.workplace_id,
    v_actor,
    p_condition,
    p_quantity,
    v_phase_label||case when v_notes is null then '' else ' · '||v_notes end
  );

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,
    'inventory.workplace.'||p_phase||'.'||p_condition,
    'inventory_item',
    v_item.id,
    jsonb_build_object(
      'event_id',v_item.event_id,
      'workplace_id',v_item.workplace_id,
      'phase',p_phase,
      'condition',p_condition,
      'quantity',p_quantity,
      'notes',v_notes
    )
  );

  insert into public.crew_notifications(user_id,title,body,link,kind)
  select p.id,
    case when p_condition='damaged' then 'Kapot materiaal gemeld' else 'Ontbrekend materiaal gemeld' end,
    trim(v_item.name)||' · '||p_quantity::text||' stuk(s) · '||lower(v_phase_label),
    '/inventory',
    'inventory'
  from public.profiles p
  where p.approved=true
    and p.role='admin'
    and p.id<>v_actor;
end;
$function$;

revoke all on function public.upt_report_workplace_inventory_condition(uuid,text,text,integer,text)
from public,anon;
grant execute on function public.upt_report_workplace_inventory_condition(uuid,text,text,integer,text)
to authenticated;
