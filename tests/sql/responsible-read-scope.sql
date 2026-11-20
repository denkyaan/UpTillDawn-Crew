-- Workplace-scoped Responsible and active staff workplace visibility regression.
-- Synthetic data only; rolled back.
BEGIN;

CREATE TEMP TABLE upt_scope_ids(name text primary key, id uuid default gen_random_uuid());
INSERT INTO upt_scope_ids(name) VALUES ('lead'),('staff'),('event'),('wp_own'),('wp_other'),('lead_shift'),('staff_shift');
GRANT SELECT ON upt_scope_ids TO authenticated;

INSERT INTO auth.users(id,email)
SELECT id,name||'@scope.test' FROM upt_scope_ids WHERE name IN ('lead','staff');

UPDATE public.profiles
SET approved=true,
    role=CASE WHEN i.name='lead' THEN 'responsible_lead' ELSE 'staff' END,
    full_name=initcap(i.name)||' Scope'
FROM upt_scope_ids i
WHERE profiles.id=i.id AND i.name IN ('lead','staff');

GRANT SELECT ON public.profiles TO authenticated;

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
VALUES(
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 'Responsible scope rollback',
 now()-interval '1 hour', now()+interval '1 day',
 now()-interval '1 hour', now()+interval '1 day',
 'active',
 (SELECT id FROM upt_scope_ids WHERE name='lead')
);

INSERT INTO public.workplaces(id,event_id,name,sort_order)
VALUES
(
 (SELECT id FROM upt_scope_ids WHERE name='wp_own'),
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 'Own workplace',
 10
),
(
 (SELECT id FROM upt_scope_ids WHERE name='wp_other'),
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 'Other workplace',
 20
);

INSERT INTO public.event_members(event_id,user_id,event_role)
VALUES
(
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 (SELECT id FROM upt_scope_ids WHERE name='lead'),
 'responsible_lead'
),
(
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 (SELECT id FROM upt_scope_ids WHERE name='staff'),
 'employee'
);

INSERT INTO public.shifts(
 id,event_id,workplace_id,user_id,role_name,
 start_time,end_time,scheduled_start,scheduled_end,status
)
VALUES
(
 (SELECT id FROM upt_scope_ids WHERE name='lead_shift'),
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 (SELECT id FROM upt_scope_ids WHERE name='wp_own'),
 (SELECT id FROM upt_scope_ids WHERE name='lead'),
 'Verantwoordelijke',
 now()-interval '30 minutes',now()+interval '2 hours',
 now()-interval '30 minutes',now()+interval '2 hours',
 'scheduled'
),
(
 (SELECT id FROM upt_scope_ids WHERE name='staff_shift'),
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 (SELECT id FROM upt_scope_ids WHERE name='wp_own'),
 (SELECT id FROM upt_scope_ids WHERE name='staff'),
 'Personeel',
 now()-interval '30 minutes',now()+interval '2 hours',
 now()-interval '30 minutes',now()+interval '2 hours',
 'scheduled'
);

INSERT INTO public.responsible_assignments(event_id,workplace_id,user_id)
VALUES(
 (SELECT id FROM upt_scope_ids WHERE name='event'),
 (SELECT id FROM upt_scope_ids WHERE name='wp_own'),
 (SELECT id FROM upt_scope_ids WHERE name='lead')
);

SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM upt_scope_ids WHERE name='lead'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_event_count integer;
  v_workplace_count integer;
BEGIN
  IF NOT upt_private.is_event_responsible(
    (SELECT id FROM upt_scope_ids WHERE name='event'),
    auth.uid()
  ) THEN
    RAISE EXCEPTION 'FAIL event responsible helper';
  END IF;

  SELECT count(*) INTO v_event_count
  FROM public.events
  WHERE id=(SELECT id FROM upt_scope_ids WHERE name='event');

  SELECT count(*) INTO v_workplace_count
  FROM public.workplaces
  WHERE event_id=(SELECT id FROM upt_scope_ids WHERE name='event');

  IF v_event_count <> 1 THEN
    RAISE EXCEPTION 'FAIL responsible cannot read assigned event';
  END IF;
  IF v_workplace_count <> 1 THEN
    RAISE EXCEPTION 'FAIL responsible workplace scope should expose only own workplace: got %',v_workplace_count;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.workplaces
    WHERE id=(SELECT id FROM upt_scope_ids WHERE name='wp_other')
  ) THEN
    RAISE EXCEPTION 'FAIL responsible can read unrelated workplace';
  END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM upt_scope_ids WHERE name='staff'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.workplaces
  WHERE event_id=(SELECT id FROM upt_scope_ids WHERE name='event');

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL staff workplace visibility should match assigned shift: got %',v_count;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.workplaces
    WHERE id=(SELECT id FROM upt_scope_ids WHERE name='wp_other')
  ) THEN
    RAISE EXCEPTION 'FAIL staff can read unrelated workplace';
  END IF;
END $$;
RESET ROLE;
-- RESET ROLE does not clear PostgreSQL's transaction-local JWT identity.
-- Clear it before creating another seed profile: its authorization trigger
-- must run as the privileged fixture creator, not the previous test user.
SELECT set_config('request.jwt.claim.sub', '', true);

-- A separate lead has ONLY a future assignment. Their effective
-- operational role remains staff until the event approaches; they must still
-- be able to prepare their explicitly assigned workplace and see team shifts.
INSERT INTO upt_scope_ids(name) VALUES
  ('pre_lead'),('pre_event'),('pre_wp_own'),('pre_wp_other'),('pre_staff_shift');

INSERT INTO auth.users(id,email)
SELECT id, 'pre-event-'||name||'@scope.test'
FROM upt_scope_ids WHERE name='pre_lead';

UPDATE public.profiles
SET approved=true,role='responsible_lead',full_name='Pre Event Responsible'
WHERE id=(SELECT id FROM upt_scope_ids WHERE name='pre_lead');

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
VALUES (
  (SELECT id FROM upt_scope_ids WHERE name='pre_event'),
  'Upcoming workplace RLS rollback',
  now()+interval '2 hours',now()+interval '10 hours',
  now()+interval '2 hours',now()+interval '10 hours',
  'scheduled',
  (SELECT id FROM upt_scope_ids WHERE name='lead')
);

INSERT INTO public.workplaces(id,event_id,name,sort_order)
VALUES
  ((SELECT id FROM upt_scope_ids WHERE name='pre_wp_own'),
   (SELECT id FROM upt_scope_ids WHERE name='pre_event'),
   'Assigned upcoming workplace',10),
  ((SELECT id FROM upt_scope_ids WHERE name='pre_wp_other'),
   (SELECT id FROM upt_scope_ids WHERE name='pre_event'),
   'Unassigned upcoming workplace',20);

INSERT INTO public.event_members(event_id,user_id,event_role)
VALUES
  ((SELECT id FROM upt_scope_ids WHERE name='pre_event'),
   (SELECT id FROM upt_scope_ids WHERE name='pre_lead'),'responsible_lead'),
  ((SELECT id FROM upt_scope_ids WHERE name='pre_event'),
   (SELECT id FROM upt_scope_ids WHERE name='staff'),'employee');

INSERT INTO public.responsible_assignments(event_id,workplace_id,user_id)
VALUES (
  (SELECT id FROM upt_scope_ids WHERE name='pre_event'),
  (SELECT id FROM upt_scope_ids WHERE name='pre_wp_own'),
  (SELECT id FROM upt_scope_ids WHERE name='pre_lead')
);

INSERT INTO public.shifts(
 id,event_id,workplace_id,user_id,role_name,
 start_time,end_time,scheduled_start,scheduled_end,status
)
VALUES (
 (SELECT id FROM upt_scope_ids WHERE name='pre_staff_shift'),
 (SELECT id FROM upt_scope_ids WHERE name='pre_event'),
 (SELECT id FROM upt_scope_ids WHERE name='pre_wp_own'),
 (SELECT id FROM upt_scope_ids WHERE name='staff'),
 'Pre-event staff',
 now()+interval '2 hours',now()+interval '9 hours',
 now()+interval '2 hours',now()+interval '9 hours','scheduled'
);

SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM upt_scope_ids WHERE name='pre_lead'),true);
SET LOCAL ROLE authenticated;
DO $pre_event$
DECLARE
  v_event uuid:=(SELECT id FROM upt_scope_ids WHERE name='pre_event');
  v_own uuid:=(SELECT id FROM upt_scope_ids WHERE name='pre_wp_own');
  v_other uuid:=(SELECT id FROM upt_scope_ids WHERE name='pre_wp_other');
  v_visible_workplaces integer;
  v_visible_shifts integer;
BEGIN
  IF public.upt_current_effective_role() <> 'staff' THEN
    RAISE EXCEPTION 'Pre-event fixture must be outside effective Responsible role window';
  END IF;
  IF public.upt_is_responsible(v_event,v_own,auth.uid()) THEN
    RAISE EXCEPTION 'Operational Responsible role unexpectedly active before event';
  END IF;
  IF (SELECT count(*) FROM public.events WHERE id=v_event)<>1 THEN
    RAISE EXCEPTION 'Upcoming assigned event is inaccessible';
  END IF;
  SELECT count(*) INTO v_visible_workplaces
  FROM public.workplaces WHERE event_id=v_event;
  IF v_visible_workplaces<>1 THEN
    RAISE EXCEPTION 'Pre-event lead must read exactly their own workplace, got %',v_visible_workplaces;
  END IF;
  IF EXISTS(SELECT 1 FROM public.workplaces WHERE id=v_other) THEN
    RAISE EXCEPTION 'Pre-event lead can read an unassigned workplace';
  END IF;
  SELECT count(*) INTO v_visible_shifts FROM public.shifts
  WHERE event_id=v_event AND workplace_id=v_own;
  IF v_visible_shifts<>1 THEN
    RAISE EXCEPTION 'Pre-event lead cannot inspect their assigned team shift, got %',v_visible_shifts;
  END IF;
END $pre_event$;
RESET ROLE;

REVOKE SELECT ON public.profiles FROM authenticated;
SELECT 'PASS: active and pre-event Responsible workplace/shift visibility is assignment-scoped' AS result;
ROLLBACK;
