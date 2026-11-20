-- Administration can prepare event drafts, while only a verified Admin/Owner
-- can use the existing publication/approval paths.
-- This function is intentionally narrow: no status, permissions, membership,
-- financial or final approval fields are accepted from the caller.
CREATE OR REPLACE FUNCTION public.upt_administration_save_event_draft(
 p_event_id uuid,
 p_name text,
 p_start_at timestamptz,
 p_end_at timestamptz,
 p_venue text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_event uuid;
 v_name text := btrim(coalesce(p_name,''));
 v_venue text := nullif(btrim(coalesce(p_venue,'')),'');
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF NOT (
  public.upt_is_admin(v_actor)
  OR EXISTS (
   SELECT 1
   FROM public.profiles p
   JOIN public.portal_role_assignments a ON a.user_id=p.id
   WHERE p.id=v_actor AND p.approved IS TRUE
     AND coalesce(p.account_blocked,false)=false
     AND a.portal='administration'
     AND a.role='administrative_staff'
     AND a.approved IS TRUE AND a.revoked_at IS NULL
  )
 ) THEN
  RAISE EXCEPTION 'Administration access required' USING ERRCODE='42501';
 END IF;
 IF length(v_name)<3 OR length(v_name)>200 OR length(coalesce(v_venue,''))>200
    OR p_start_at IS NULL OR p_end_at IS NULL OR p_end_at<=p_start_at THEN
  RAISE EXCEPTION 'Invalid event draft';
 END IF;
 IF p_event_id IS NULL THEN
  INSERT INTO public.events
   (name,venue,start_at,end_at,start_date,end_date,status,created_by)
  VALUES
   (v_name,v_venue,p_start_at,p_end_at,p_start_at,p_end_at,'draft',v_actor)
  RETURNING id INTO v_event;
 ELSE
  UPDATE public.events e
  SET name=v_name,venue=v_venue,start_at=p_start_at,end_at=p_end_at,
      start_date=p_start_at,end_date=p_end_at,updated_at=now()
  WHERE e.id=p_event_id AND e.status='draft'
    AND (e.created_by=v_actor OR public.upt_is_admin(v_actor))
  RETURNING e.id INTO v_event;
  IF v_event IS NULL THEN
   RAISE EXCEPTION 'Event draft not available for edit' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN v_event;
END
$$;

REVOKE ALL ON FUNCTION public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text) TO authenticated;
