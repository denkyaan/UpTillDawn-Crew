-- Main-only read-only seven-role permission acceptance.
-- Requires the seven existing Main QA bot identities; never creates or edits
-- users, roles, credentials or real crew data. Every session is transactional.
BEGIN;
CREATE TEMP TABLE qa_operational_access(name text PRIMARY KEY,id uuid NOT NULL,expected_admin boolean NOT NULL);
\if :{?PHASE23_LOCAL_ROLE_FIXTURES}
INSERT INTO qa_operational_access(name,id,expected_admin)
SELECT v.name,u.id,v.expected_admin
FROM (VALUES
 ('head_admin','bot-01-admin-nl@bots.uptilldawn.test',true),
 ('left_hand','bot-06-staff-fr@bots.uptilldawn.test',true),
 ('right_hand','bot-07-staff-en@bots.uptilldawn.test',true),
 ('administration','bot-04-staff-de@bots.uptilldawn.test',true),
 ('promotion','bot-05-staff-nl@bots.uptilldawn.test',false),
 ('responsible','bot-02-responsible-fr@bots.uptilldawn.test',false),
 ('staff','bot-03-staff-en@bots.uptilldawn.test',false)
) v(name,email,expected_admin)
JOIN auth.users u ON lower(u.email)=v.email;
\else
INSERT INTO qa_operational_access(name,id,expected_admin)
SELECT v.name,u.id,v.expected_admin
FROM (VALUES
 ('head_admin','e2e-head-admin@uptilldawn.test',true),
 ('left_hand','e2e-admin@uptilldawn.test',true),
 ('right_hand','e2e-right-hand@uptilldawn.test',true),
 ('administration','e2e-administration@uptilldawn.test',true),
 ('promotion','e2e-promotion@uptilldawn.test',false),
 ('responsible','e2e-responsible@uptilldawn.test',false),
 ('staff','e2e-staff@uptilldawn.test',false)
) v(name,email,expected_admin)
JOIN auth.users u ON lower(u.email)=v.email;
\endif
GRANT SELECT ON qa_operational_access TO authenticated;

SET LOCAL ROLE authenticated;
DO $verify_role_matrix$
DECLARE
  v_row record;
  v_can_manage boolean;
BEGIN
  IF (SELECT count(*) FROM qa_operational_access)<>7 THEN
    RAISE EXCEPTION 'FAIL: Main seven-role QA bot inventory incomplete';
  END IF;
  FOR v_row IN SELECT name,id,expected_admin FROM qa_operational_access LOOP
    PERFORM set_config('request.jwt.claim.sub',v_row.id::text,true);
    IF auth.uid() IS DISTINCT FROM v_row.id THEN
      RAISE EXCEPTION 'FAIL: JWT session binding incorrect for %',v_row.name;
    END IF;
    IF NOT public.upt_is_approved() THEN
      RAISE EXCEPTION 'FAIL: active QA role rejected as unapproved: %',v_row.name;
    END IF;
    SELECT public.upt_can_manage_administration() INTO v_can_manage;
    IF v_can_manage IS DISTINCT FROM v_row.expected_admin THEN
      RAISE EXCEPTION 'FAIL: % has unexpected Administration permission',v_row.name;
    END IF;
  END LOOP;
END $verify_role_matrix$;
RESET ROLE;
SELECT 'PASS: all seven operational Main roles have the expected live Administration rights' AS result;
ROLLBACK;
