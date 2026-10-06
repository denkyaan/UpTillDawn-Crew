create or replace function public.upt_create_inventory_item(
  p_workplace uuid,
  p_name text,
  p_category text default null,
  p_quantity integer default 1,
  p_item_kind text default 'consumable'
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_item uuid;
  v_category text:=nullif(trim(coalesce(p_category,'')),'');
  v_admin boolean;
  v_kind text:=coalesce(nullif(trim(p_item_kind),''),'consumable');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  v_admin:=public.upt_is_admin(v_actor);
  if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Geef een geldige materiaalnaam.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100000 then raise exception 'Ongeldige hoeveelheid.'; end if;
  if v_kind not in ('asset','consumable') then raise exception 'Ongeldig materiaaltype.'; end if;

  select w.event_id into v_event
  from public.workplaces w
  join public.events e on e.id=w.event_id
  where w.id=p_workplace
    and w.is_active=true
    and (v_admin or (coalesce(e.status,'')<>'archived' and now()<=e.end_at))
  for update of w;
  if not found then raise exception 'Werkplek niet beschikbaar.'; end if;

  if not upt_private.inventory_can_manage(v_event,p_workplace) then
    raise exception 'Geen toegang tot materiaalbeheer op deze werkplek.';
  end if;

  begin
    insert into public.inventory_items(
      event_id,workplace_id,name,category,total_quantity,available_quantity,created_by,item_kind
    )
    values(v_event,p_workplace,trim(p_name),v_category,p_quantity,p_quantity,v_actor,v_kind)
    returning id into v_item;
  exception when unique_violation then
    raise exception 'Er bestaat al actief materiaal met deze naam op de werkplek.';
  end;

  insert into public.inventory_movements(item_id,event_id,workplace_id,actor_id,movement_type,quantity,notes)
  values(v_item,v_event,p_workplace,v_actor,'created',p_quantity,'Initiële voorraad');

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.item.created','inventory_item',v_item,jsonb_build_object(
    'event_id',v_event,'workplace_id',p_workplace,'quantity',p_quantity,'item_kind',v_kind
  ));

  return v_item;
end;
$$;

revoke all on function public.upt_create_inventory_item(uuid,text,text,integer,text) from public,anon;
grant execute on function public.upt_create_inventory_item(uuid,text,text,integer,text) to authenticated;
notify pgrst,'reload schema';
