-- Prevent authenticated callers from clearing another login's security state.
-- Post-sign-in Admin callers pass the canonical Auth email (including Maker alias
-- resolution), never an unverified user-controlled login key.
CREATE OR REPLACE FUNCTION public.upt_admin_login_success(
  p_login text,p_ip text DEFAULT NULL::text,p_location text DEFAULT NULL::text,p_user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','upt_private','auth'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_key text := lower(btrim(coalesce(p_login,'')));
  v_verified_login text;
  v_count integer;
BEGIN
  IF v_actor IS NULL
     OR NOT public.upt_is_approved()
     OR NOT public.upt_is_admin(v_actor) THEN
    RAISE EXCEPTION 'Admin access required' USING errcode='42501';
  END IF;

  SELECT lower(btrim(u.email))
    INTO v_verified_login
  FROM auth.users u
  WHERE u.id=v_actor;

  -- A client must not delete another account's lockout/audit state.
  IF v_key='' OR length(v_key)>320 OR v_verified_login IS NULL
    OR v_key IS DISTINCT FROM v_verified_login THEN
    RAISE EXCEPTION 'Verified login does not match signed-in Admin'
      USING errcode='42501';
  END IF;

  SELECT failed_attempts INTO v_count
  FROM upt_private.admin_login_attempts
  WHERE login_key=v_key
  FOR UPDATE;

  IF coalesce(v_count,0)>0 THEN
    INSERT INTO upt_private.admin_login_security_events(
      event_type,login_key,failed_attempts,ip_address,approximate_location,user_agent
    ) VALUES(
      'successful_login_after_failures',v_key,v_count,
      left(p_ip,128),left(p_location,300),left(p_user_agent,1000)
    );
  END IF;

  DELETE FROM upt_private.admin_login_attempts WHERE login_key=v_key;
END;
$function$;
REVOKE ALL ON FUNCTION public.upt_admin_login_success(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upt_admin_login_success(text,text,text,text) TO authenticated;
