-- PRODUCTION-ONLY, PREPARED / NOT APPLIED. Requires separate explicit release approval.
-- Do not add to the ordinary supabase/migrations chain: Production has its own
-- historical alignment versions. Run only against the confirmed Production DB,
-- after verified backup/recovery, exact DB preflight and operational approval.
-- This is a single atomic transaction. Any unexpected database state fails before
-- DDL. No table changes, data modifications, account changes, webhook or payment.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $upt_prod_precheck$
DECLARE
 v_latest text;
 v_old_function text;
BEGIN
 SELECT max(version) INTO v_latest FROM supabase_migrations.schema_migrations;
 IF v_latest IS DISTINCT FROM '20261112062000' THEN
  RAISE EXCEPTION 'Production migration baseline changed: review required';
 END IF;
 IF to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'Event draft function already exists: inspect before replacing';
 END IF;
 IF to_regprocedure('public.upt_current_effective_role()') IS NULL
  OR to_regprocedure('public.upt_set_admin_role_mode(text)') IS NULL
  OR to_regprocedure('public.upt_is_admin(uuid)') IS NULL
  OR to_regprocedure('upt_private.is_app_owner(uuid)') IS NULL
  OR to_regclass('public.portal_role_assignments') IS NULL
  OR to_regclass('public.admin_role_modes') IS NULL
  OR to_regclass('public.events') IS NULL
  OR to_regclass('public.profiles') IS NULL
 THEN RAISE EXCEPTION 'Existing required Production dependencies missing'; END IF;
 v_old_function := pg_get_functiondef('public.upt_current_effective_role()'::regprocedure);
 IF md5(v_old_function) <> '8ec846af135d9ac695a6fb73a129ccfa' THEN
  RAISE EXCEPTION 'Production effective-role function changed: new review required';
 END IF;
 IF md5(pg_get_functiondef('public.upt_is_admin(uuid)'::regprocedure))
  <> '83af753ac2464c3bac15e2b0073f83b0'
  OR md5(pg_get_functiondef('upt_private.is_app_owner(uuid)'::regprocedure))
  <> 'e2c6d5521b80a1de67695077ca206a58'
 THEN RAISE EXCEPTION 'Production admin/Owner authorization logic changed'; END IF;
 IF NOT has_function_privilege('authenticated','public.upt_current_effective_role()','EXECUTE')
  OR has_function_privilege('anon','public.upt_current_effective_role()','EXECUTE')
 THEN RAISE EXCEPTION 'Unexpected effective-role function ACL'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='events'
    AND column_name='end_at' AND udt_name='timestamptz'
 ) OR NOT EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='portal_role_assignments'
    AND column_name='revoked_at' AND udt_name='timestamptz'
 ) THEN
  RAISE EXCEPTION 'Event/role assignment schema mismatch';
 END IF;
END;
$upt_prod_precheck$;

-- Canonical Main function from
-- supabase/migrations/20261112215746_administration_event_draft_workflow.sql.
-- Intentional SECURITY DEFINER: explicit caller identity + approval + portal
-- grant + revocation checks, narrow event columns, drafts only.
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
AS $upt_event_draft$
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
END;
$upt_event_draft$;

-- Canonical Main Owner/operational role selection from
-- supabase/migrations/20261112195755_maker_owner_effective_role_mode_fix.sql.
-- The storage/permission RPC upt_set_admin_role_mode(text) is not replaced:
-- its Production code was verified semantically equivalent to Main.
CREATE OR REPLACE FUNCTION public.upt_current_effective_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path='pg_catalog','public','upt_private'
AS $upt_owner_mode$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN upt_private.is_app_owner(auth.uid()) THEN coalesce(
      (SELECT m.active_role
       FROM public.admin_role_modes m
       WHERE m.user_id=auth.uid()
         AND m.active_role IN ('admin','staff','responsible_lead')),
      'admin'
    )
    ELSE public.upt_effective_role(auth.uid())
  END;
$upt_owner_mode$;

-- PostgreSQL's default PUBLIC EXECUTE must never expose SECURITY DEFINER RPCs.
REVOKE ALL ON FUNCTION public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)
 TO authenticated;
REVOKE ALL ON FUNCTION public.upt_current_effective_role()
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upt_current_effective_role() TO authenticated;

DO $upt_prod_postcheck$
BEGIN
 IF to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)') IS NULL
  OR NOT has_function_privilege('authenticated',
    'public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)','EXECUTE')
  OR has_function_privilege('anon',
    'public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)','EXECUTE')
  OR has_function_privilege('anon','public.upt_current_effective_role()','EXECUTE')
  OR NOT has_function_privilege('authenticated','public.upt_current_effective_role()','EXECUTE')
 THEN RAISE EXCEPTION 'Target RPC security contract was not installed'; END IF;
 IF position('upt_private.is_app_owner' IN
   pg_get_functiondef('public.upt_current_effective_role()'::regprocedure))=0
  OR position('responsible_lead' IN
   pg_get_functiondef('public.upt_current_effective_role()'::regprocedure))=0
 THEN RAISE EXCEPTION 'Maker active-role contract not installed'; END IF;
END;
$upt_prod_postcheck$;

SELECT pg_notify('pgrst','reload schema');
COMMIT;
