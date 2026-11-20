-- Fail isolated release CI if any privileged task/driver helper can answer
-- authorization questions for a supplied user other than the caller.
-- Assert callable signatures, grants, central active-account guard and role
-- contract while preserving all existing task/driver RLS call sites.
DO $actor_binding$
DECLARE
 v_fn text;
 v_oid oid;
 v_definition text;
BEGIN
 FOREACH v_fn IN ARRAY ARRAY[
  'upt_can_manage_task',
  'upt_can_read_task',
  'upt_is_driver_supervisor'
 ] LOOP
  v_oid:=to_regprocedure('public.'||v_fn||'(uuid,uuid)');
  IF v_oid IS NULL THEN
   RAISE EXCEPTION 'FAIL missing required task/driver RPC: %',v_fn;
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_definition;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=v_oid AND p.prosecdef)
   OR position('p_uid = (SELECT auth.uid())' IN v_definition)=0
   OR position('upt_is_approved()' IN v_definition)=0
  THEN
   RAISE EXCEPTION 'FAIL RPC permits delegated identity or blocked account: %',v_fn;
  END IF;
  IF has_function_privilege('anon',v_oid,'EXECUTE')
   OR has_function_privilege('public',v_oid,'EXECUTE')
   OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
  THEN
   RAISE EXCEPTION 'FAIL task/driver RPC execute grants: %',v_fn;
  END IF;
  IF NOT EXISTS(
   SELECT 1 FROM pg_proc p
   WHERE p.oid=v_oid AND EXISTS(
    SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) cfg
    WHERE cfg LIKE 'search_path=%'
   )
  ) THEN
   RAISE EXCEPTION 'FAIL task/driver RPC unpinned search_path: %',v_fn;
  END IF;
 END LOOP;
 -- Guard the real driver dashboard, which contains passenger contact/location
 -- information, against a future bypass of the identity-scoped helper.
 SELECT pg_get_functiondef('public.upt_driver_dashboard(uuid)'::regprocedure)
 INTO v_definition;
 IF position('upt_is_driver_supervisor(p_event,auth.uid())' IN v_definition)=0
  OR position('upt_is_admin(auth.uid())' IN v_definition)=0 THEN
  RAISE EXCEPTION 'FAIL driver dashboard no longer checks caller role';
 END IF;
END $actor_binding$;
SELECT 'PASS: task and driver SECURITY DEFINER RPCs bind privileges to the active caller' AS result;
