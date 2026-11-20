-- Release regression: privileged admin login success cannot erase arbitrary
-- login-attempt / lockout records. Does not read or modify real account data.
DO $admin_success_scope$
DECLARE
 v_fn oid;
 v_body text;
BEGIN
 v_fn:=to_regprocedure('public.upt_admin_login_success(text,text,text,text)');
 IF v_fn IS NULL THEN
  RAISE EXCEPTION 'FAIL: Admin login audit RPC missing';
 END IF;

 SELECT pg_get_functiondef(v_fn) INTO v_body;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=v_fn AND prosecdef)
  OR position('auth.uid()' IN v_body)=0
  OR position('public.upt_is_approved()' IN v_body)=0
  OR position('public.upt_is_admin(v_actor)' IN v_body)=0
  OR position('FROM auth.users u' IN v_body)=0
  OR position('WHERE u.id=v_actor' IN v_body)=0
  OR position('v_key IS DISTINCT FROM v_verified_login' IN v_body)=0
  OR position('FOR UPDATE' IN v_body)=0
  OR position('DELETE FROM upt_private.admin_login_attempts WHERE login_key=v_key' IN v_body)=0
 THEN
  RAISE EXCEPTION 'FAIL: Admin login success can modify a foreign login audit';
 END IF;

 IF has_function_privilege('anon',v_fn,'EXECUTE')
  OR has_function_privilege('public',v_fn,'EXECUTE')
  OR NOT has_function_privilege('authenticated',v_fn,'EXECUTE')
 THEN
  RAISE EXCEPTION 'FAIL: Admin login success has unsafe executable grants';
 END IF;

 IF NOT EXISTS(
  SELECT 1 FROM pg_proc p
  WHERE p.oid=v_fn
    AND EXISTS(SELECT 1 FROM unnest(coalesce(p.proconfig,ARRAY[]::text[])) cfg WHERE cfg LIKE 'search_path=%')
 ) THEN
  RAISE EXCEPTION 'FAIL: Admin login success search_path is not pinned';
 END IF;
END $admin_success_scope$;

SELECT 'PASS: successful login audit requires same verified Admin account and cannot clear foreign lockout records' AS result;
