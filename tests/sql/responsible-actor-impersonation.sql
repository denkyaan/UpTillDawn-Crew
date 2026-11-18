-- Transactional, real-identity RLS/RPC regression: no persistent fixtures.
BEGIN;
CREATE TEMP TABLE qa_responsible_actor_ids(name text primary key,id uuid default gen_random_uuid());
INSERT INTO qa_responsible_actor_ids(name) VALUES('lead'),('staff'),('event'),('workplace');
GRANT SELECT ON qa_responsible_actor_ids TO authenticated;

INSERT INTO auth.users(id,email)
SELECT id,name||'@responsible-actor-rollback.test'
FROM qa_responsible_actor_ids WHERE name IN ('lead','staff');

UPDATE public.profiles p
SET approved=true,
    role=CASE WHEN x.name='lead' THEN 'responsible_lead' ELSE 'staff' END,
    full_name=initcap(x.name)||' Test'
FROM qa_responsible_actor_ids x
WHERE p.id=x.id AND x.name IN ('lead','staff');

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
SELECT id,'Actor spoof rollback fixture',
  now()-interval '30 minutes',now()+interval '2 hours',
  now()-interval '30 minutes',now()+interval '2 hours',
  'active',
  (SELECT id FROM qa_responsible_actor_ids WHERE name='lead')
FROM qa_responsible_actor_ids WHERE name='event';

INSERT INTO public.workplaces(id,event_id,name)
VALUES(
  (SELECT id FROM qa_responsible_actor_ids WHERE name='workplace'),
  (SELECT id FROM qa_responsible_actor_ids WHERE name='event'),
  'Isolated booth'
);

INSERT INTO public.event_members(event_id,user_id,event_role)
VALUES(
  (SELECT id FROM qa_responsible_actor_ids WHERE name='event'),
  (SELECT id FROM qa_responsible_actor_ids WHERE name='lead'),
  'responsible_lead'
);

INSERT INTO public.responsible_assignments(event_id,workplace_id,user_id)
VALUES(
  (SELECT id FROM qa_responsible_actor_ids WHERE name='event'),
  (SELECT id FROM qa_responsible_actor_ids WHERE name='workplace'),
  (SELECT id FROM qa_responsible_actor_ids WHERE name='lead')
);

-- Staff must not impersonate the assigned Responsible via explicit user ID.
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM qa_responsible_actor_ids WHERE name='staff'),true);
SET LOCAL ROLE authenticated;
DO $verify_staff$
DECLARE
  v_event uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='event');
  v_workplace uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='workplace');
  v_other uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='lead');
BEGIN
  IF public.upt_is_responsible(v_event,v_workplace,v_other) THEN
    RAISE EXCEPTION 'FAIL: Staff can impersonate another Responsible using explicit uid';
  END IF;
  IF public.upt_is_responsible(v_event,v_workplace) THEN
    RAISE EXCEPTION 'FAIL: Staff has unintended workplace responsibility';
  END IF;
END $verify_staff$;
RESET ROLE;

-- Genuine Responsible must keep their workplace and event-wide entitlement.
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM qa_responsible_actor_ids WHERE name='lead'),true);
SET LOCAL ROLE authenticated;
DO $verify_lead$
DECLARE
  v_event uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='event');
  v_workplace uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='workplace');
  v_other uuid := (SELECT id FROM qa_responsible_actor_ids WHERE name='staff');
BEGIN
  IF NOT public.upt_is_responsible(v_event,v_workplace)
    OR NOT public.upt_is_responsible(v_event,v_workplace,auth.uid())
    OR NOT public.upt_is_responsible(v_event,NULL,auth.uid())
  THEN
    RAISE EXCEPTION 'FAIL: genuine Responsible lost assigned workplace or event access';
  END IF;
  IF public.upt_is_responsible(v_event,v_workplace,v_other) THEN
    RAISE EXCEPTION 'FAIL: Responsible may query another identity';
  END IF;
END $verify_lead$;
RESET ROLE;

DO $role_grants$
DECLARE v_oid oid := 'public.upt_is_responsible(uuid,uuid,uuid)'::regprocedure;
BEGIN
 IF has_function_privilege('anon',v_oid,'EXECUTE')
  OR has_function_privilege('public',v_oid,'EXECUTE')
  OR NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: Responsible role RPC grants are unsafe'; END IF;
 IF position('uid = (SELECT auth.uid())' IN pg_get_functiondef(v_oid))=0
  OR position('upt_is_approved()' IN pg_get_functiondef(v_oid))=0
 THEN RAISE EXCEPTION 'FAIL: Responsible role RPC is not session bound'; END IF;
END $role_grants$;

SELECT 'PASS: Staff cannot spoof another Responsible and genuine Responsible retains event/workplace access' AS result;
ROLLBACK;
