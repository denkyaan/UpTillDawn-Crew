-- Database release security regression. Pure assertions: no data mutations.
-- Requires the same central approval guard used by RLS and RPC gates.
DO $blocked_guard$
DECLARE
  v_oid oid;
  v_sql text;
BEGIN
  v_oid := to_regprocedure('public.upt_is_approved()');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'FAIL: central account approval RPC missing';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_sql;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef)
    OR v_sql NOT LIKE '%p.approved = true%'
    OR v_sql NOT LIKE '%p.account_blocked%'
    OR v_sql NOT LIKE '%upt_private.is_app_owner(auth.uid())%'
    OR v_sql NOT LIKE '%auth.uid() is not null%'
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid=v_oid AND EXISTS(
        SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
    ) THEN
    RAISE EXCEPTION 'FAIL: central approval RPC no longer requires signed, approved, unblocked user or Maker recovery';
  END IF;

  IF has_function_privilege('anon',v_oid,'EXECUTE')
    OR has_function_privilege('public',v_oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: central approval RPC has unsafe execution grants';
  END IF;

  IF has_column_privilege('authenticated','public.profiles','role','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','approved','UPDATE')
    OR has_column_privilege('authenticated','public.profiles','account_blocked','UPDATE') THEN
    RAISE EXCEPTION 'FAIL: signed-in users may directly change their own approval, block status or admin role';
  END IF;

  IF NOT has_column_privilege('authenticated','public.profiles','full_name','UPDATE') THEN
    RAISE EXCEPTION 'FAIL: ordinary editable profile fields were unintentionally locked';
  END IF;
END $blocked_guard$;

SELECT 'PASS: RLS approval rejects blocked status, preserves Maker recovery, and profile privilege boundaries remain intact' AS result;
