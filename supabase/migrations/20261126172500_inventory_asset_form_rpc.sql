-- Asset form: retain the canonical audited mutation and preserve fields
-- not present in the original form. No direct inventory table write grants.
CREATE OR REPLACE FUNCTION public.upt_update_inventory_asset_form(
  p_item uuid,
  p_asset_code text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_serial_number text DEFAULT NULL,
  p_location_label text DEFAULT NULL,
  p_maintenance_due_at timestamptz DEFAULT NULL,
  p_reorder_threshold integer DEFAULT 0,
  p_unit_cost_cents integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog','public'
AS $asset$
DECLARE
  v_actor uuid := auth.uid();
  v_item public.inventory_items%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.upt_is_approved() OR NOT public.upt_is_admin(v_actor) THEN
    RAISE EXCEPTION 'Alleen admin kan assetgegevens beheren.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_item FROM public.inventory_items
    WHERE id=p_item AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Materiaal niet gevonden.'; END IF;
  PERFORM public.upt_update_inventory_asset_metadata(
    p_item=>p_item,
    p_asset_code=>left(p_asset_code,120),
    p_barcode=>left(p_barcode,200),
    p_serial_number=>left(p_serial_number,200),
    p_photo_path=>v_item.photo_path,
    p_purchase_date=>v_item.purchase_date,
    p_last_maintenance_at=>v_item.last_maintenance_at,
    p_maintenance_due_at=>p_maintenance_due_at,
    p_location_label=>left(p_location_label,300),
    p_reorder_threshold=>p_reorder_threshold,
    p_unit_cost_cents=>p_unit_cost_cents,
    p_notes=>left(p_notes,4000)
  );
END;
$asset$;
REVOKE ALL ON FUNCTION public.upt_update_inventory_asset_form(uuid,text,text,text,text,timestamptz,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upt_update_inventory_asset_form(uuid,text,text,text,text,timestamptz,integer,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
