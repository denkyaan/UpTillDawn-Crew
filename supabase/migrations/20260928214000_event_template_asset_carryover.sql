create or replace function upt_private.enrich_event_template_inventory()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','public','upt_private'
as $$
begin
  if new.source_event_id is null or not ('inventory'=any(coalesce(new.sections,array[]::text[]))) then
    return new;
  end if;

  new.configuration:=jsonb_set(
    coalesce(new.configuration,'{}'::jsonb),
    '{inventory}',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'workplaceId',i.workplace_id,
        'name',i.name,
        'category',i.category,
        'totalQuantity',i.total_quantity,
        'reorderThreshold',i.reorder_threshold,
        'unitCostCents',i.unit_cost_cents,
        'locationLabel',i.location_label,
        'assetNotes',i.asset_notes,
        'itemKind',i.item_kind,
        'assetCode',i.asset_code,
        'barcode',i.barcode,
        'serialNumber',i.serial_number
      ) order by i.category,i.name)
      from public.inventory_items i
      where i.event_id=new.source_event_id and i.is_active=true
    ),'[]'::jsonb),
    true
  );
  return new;
end;
$$;

drop trigger if exists event_template_asset_enrichment on public.event_templates;
create trigger event_template_asset_enrichment
before insert or update of configuration,source_event_id,sections on public.event_templates
for each row execute function upt_private.enrich_event_template_inventory();

create or replace function public.upt_apply_event_template_v2(
  p_template uuid,p_name text,p_start timestamptz,p_end timestamptz,p_venue text default null,p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare
  v_actor uuid:=auth.uid();
  v_event uuid;
  v_config jsonb;
  v_row jsonb;
  v_source_workplace uuid;
  v_source_name text;
  v_new_workplace uuid;
begin
  if v_actor is null or not public.upt_is_approved() or not public.upt_is_admin(v_actor) then raise exception 'Alleen admin kan eventtemplates toepassen.'; end if;
  v_event:=public.upt_apply_event_template(p_template,p_name,p_start,p_end,p_venue,p_address);
  select configuration into v_config from public.event_templates where id=p_template;

  for v_row in select * from jsonb_array_elements(coalesce(v_config->'inventory','[]'::jsonb))
  loop
    v_source_workplace:=nullif(v_row->>'workplaceId','')::uuid;
    select w.name into v_source_name from public.workplaces w where w.id=v_source_workplace;
    if v_source_name is null then continue; end if;
    select w.id into v_new_workplace from public.workplaces w
    where w.event_id=v_event and lower(w.name)=lower(v_source_name)
    order by w.created_at limit 1;

    if v_new_workplace is not null then
      update public.inventory_items i
      set item_kind=case when v_row->>'itemKind' in ('asset','consumable') then v_row->>'itemKind' else 'consumable' end,
          asset_code=nullif(v_row->>'assetCode',''),
          barcode=nullif(v_row->>'barcode',''),
          serial_number=nullif(v_row->>'serialNumber',''),
          updated_at=now()
      where i.event_id=v_event and i.workplace_id=v_new_workplace and lower(i.name)=lower(v_row->>'name');
    end if;
  end loop;
  return v_event;
end;
$$;

revoke all on function public.upt_apply_event_template_v2(uuid,text,timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.upt_apply_event_template_v2(uuid,text,timestamptz,timestamptz,text,text) to authenticated;
notify pgrst,'reload schema';
