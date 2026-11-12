-- Local-only Maker/Head separation and directory privacy regression.
-- The outer transaction rolls back every Head assignment and audit row.
BEGIN;
DO $qa$
DECLARE
 v_owner uuid;
 v_head uuid;
 v_visible integer;
 v_denied boolean:=false;
BEGIN
 SELECT u.id INTO STRICT v_owner FROM auth.users u
  WHERE u.email='bot-16-maker@bots.uptilldawn.test';
 SELECT u.id INTO STRICT v_head FROM auth.users u
  WHERE u.email='bot-01-admin-nl@bots.uptilldawn.test';
 IF NOT EXISTS(SELECT 1 FROM upt_private.app_owners WHERE user_id=v_owner)
 THEN RAISE EXCEPTION 'Maker was not registered as owner';END IF;
 IF NOT public.upt_is_admin(v_owner) THEN
  RAISE EXCEPTION 'Maker lost permanent Admin authority';END IF;
 IF (SELECT role FROM public.profiles WHERE id=v_owner)<>'staff' THEN
  RAISE EXCEPTION 'Maker has an operational Admin profile role';END IF;
 IF EXISTS(SELECT 1 FROM public.upt_organization_leadership WHERE user_id=v_owner)
 THEN RAISE EXCEPTION 'Maker occupies an operational leadership slot';END IF;
 IF EXISTS(SELECT 1 FROM public.upt_personnel_role_slots WHERE user_id=v_owner)
 THEN RAISE EXCEPTION 'Maker has editable personnel roles';END IF;
 PERFORM set_config('request.jwt.claim.sub',v_owner::text,true);
 -- Grant an independent operational Head from the Maker console.
 PERFORM public.upt_leadership_assign('head',v_head);
 IF NOT EXISTS(SELECT 1 FROM public.upt_organization_leadership WHERE slot='head' AND user_id=v_head)
 THEN RAISE EXCEPTION 'Maker cannot nominate a separate Head';END IF;
 IF NOT public.upt_is_admin(v_owner) OR NOT public.upt_is_admin(v_head)
 THEN RAISE EXCEPTION 'Maker and Head authority not independent';END IF;
 BEGIN
  PERFORM public.upt_leadership_assign('head',v_owner);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Maker could become Head';END IF;
 v_denied:=false;
 BEGIN
  PERFORM public.upt_admin_set_two_personnel_roles(v_owner,'head',null,true);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Maker was editable as an employee';END IF;
END $qa$;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='bot-16-maker@bots.uptilldawn.test'),true);
-- Remember the test identity before dropping privileges: authenticated cannot read auth.users.
SELECT set_config('upt.qa_owner_id',(SELECT id::text FROM auth.users WHERE email='bot-16-maker@bots.uptilldawn.test'),true);
SET LOCAL ROLE authenticated;
DO $qa$
DECLARE v_owner uuid:=current_setting('upt.qa_owner_id')::uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.upt_admin_personnel_details_v2() WHERE id=v_owner)
 OR EXISTS(SELECT 1 FROM public.upt_crew_directory() WHERE id=v_owner)
 OR EXISTS(SELECT 1 FROM public.upt_promotion_directory() WHERE id=v_owner)
 THEN RAISE EXCEPTION 'Maker appears in employee directory';END IF;
 IF NOT public.upt_current_is_owner() THEN
  RAISE EXCEPTION 'Maker cannot access owner-only features';END IF;
 IF public.upt_current_effective_role() IS DISTINCT FROM 'admin' THEN
  RAISE EXCEPTION 'Owner effective Admin mode was masked by staff profile';END IF;
END $qa$;
-- Each assertion is a separate SQL statement because stable SQL functions
-- see the statement snapshot, not writes made earlier in one DO block.
SELECT public.upt_set_admin_role_mode('staff');
DO $BEGIN IF public.upt_current_effective_role() IS DISTINCT FROM 'staff'
 THEN RAISE EXCEPTION 'Maker did not enter Staff mode'; END IF; END$;
SELECT public.upt_set_admin_role_mode('responsible_lead');
DO $BEGIN IF public.upt_current_effective_role() IS DISTINCT FROM 'responsible_lead'
 THEN RAISE EXCEPTION 'Maker did not enter Responsible mode'; END IF; END$;
SELECT public.upt_set_admin_role_mode('admin');
DO $BEGIN IF public.upt_current_effective_role() IS DISTINCT FROM 'admin'
 THEN RAISE EXCEPTION 'Maker cannot return to Admin mode'; END IF; END$;
RESET ROLE;
SELECT 'PASS: isolated Maker retains owner authority, can appoint independent Head, cannot become Head, and is absent from ordinary staff directories' AS result;
ROLLBACK;
