-- UPTILLDAWN function permission hardening
-- Remove unnecessary PUBLIC/anon execution rights.
-- Historical installations may contain routines that are absent from a clean
-- migration replay, so every permission mutation is guarded by to_regprocedure.

DO $$
DECLARE
  sig text;
  proc regprocedure;
BEGIN
  -- Trigger/internal functions: never directly executable by clients.
  FOREACH sig IN ARRAY ARRAY[
    'public.handle_check_in_approval()',
    'public.handle_new_user()',
    'public.upt_protect_profile_security_fields()'
  ]
  LOOP
    proc := to_regprocedure(sig);
    IF proc IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', proc);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', proc);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', proc);
    END IF;
  END LOOP;

  -- Authenticated helper/RPC functions.
  FOREACH sig IN ARRAY ARRAY[
    'public.upt_is_admin(uuid)',
    'public.upt_is_responsible(uuid,uuid,uuid)',
    'public.upt_responsible_crew_directory(uuid,uuid)',
    'public.upt_start_work(uuid,uuid)',
    'public.upt_start_break(uuid)',
    'public.upt_stop_break(uuid)',
    'public.upt_stop_work(uuid)'
  ]
  LOOP
    proc := to_regprocedure(sig);
    IF proc IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', proc);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', proc);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', proc);
    END IF;
  END LOOP;
END
$$;
