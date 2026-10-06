create unique index if not exists inventory_asset_code_event_unique
on public.inventory_items(event_id,asset_code) where asset_code is not null and asset_code<>'';
create unique index if not exists inventory_barcode_event_unique
on public.inventory_items(event_id,barcode) where barcode is not null and barcode<>'';
create unique index if not exists inventory_serial_event_unique
on public.inventory_items(event_id,serial_number) where serial_number is not null and serial_number<>'';

create or replace function public.upt_set_inventory_asset_details(
  p_item uuid,
  p_kind text,
  p_asset_code text default null,
  p_barcode text default null,
  p_serial_number text default null
)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
declare
  v_actor uuid:=auth.uid();
  v_item public.inventory_items%rowtype;
  v_kind text:=coalesce(nullif(trim(p_kind),''),'consumable');
begin
  if v_actor is null or not public.upt_is_approved() then raise exception 'Aanmelden vereist.'; end if;
  if v_kind not in ('asset','consumable') then raise exception 'Ongeldig materiaaltype.'; end if;
  select * into v_item from public.inventory_items where id=p_item for update;
  if not found then raise exception 'Materiaal niet gevonden.'; end if;
  if not upt_private.inventory_can_manage(v_item.event_id,v_item.workplace_id) then raise exception 'Geen toegang tot materiaalbeheer.'; end if;

  update public.inventory_items
  set item_kind=v_kind,
      asset_code=case when v_kind='asset' then nullif(left(trim(coalesce(p_asset_code,'')),120),'') else null end,
      barcode=case when v_kind='asset' then nullif(left(trim(coalesce(p_barcode,'')),120),'') else null end,
      serial_number=case when v_kind='asset' then nullif(left(trim(coalesce(p_serial_number,'')),200),'') else null end,
      updated_at=now()
  where id=p_item;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'inventory.asset.details','inventory_item',p_item,jsonb_build_object(
    'item_kind',v_kind,'asset_code',nullif(trim(coalesce(p_asset_code,'')),''),
    'barcode',nullif(trim(coalesce(p_barcode,'')),''),'serial_number',nullif(trim(coalesce(p_serial_number,'')),'')
  ));
exception when unique_violation then
  raise exception 'Assetcode, barcode of serienummer bestaat al binnen dit evenement.';
end;
$$;
revoke all on function public.upt_set_inventory_asset_details(uuid,text,text,text,text) from public,anon;
grant execute on function public.upt_set_inventory_asset_details(uuid,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
