-- Transactional standard-workplace regression: no permanent test data.
-- Run in the ordinary SQL regression stage after all migrations.
BEGIN;

DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['Lockers','Stage Managers'] LOOP
    IF (
      SELECT count(*)
      FROM public.workplace_catalog
      WHERE lower(trim(name))=lower(v_name)
        AND is_active=true
    ) <> 1 THEN
      RAISE EXCEPTION 'Expected exactly one active % standard catalog workplace', v_name;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.upt_profile_workplace_options()
      WHERE lower(trim(name))=lower(v_name)
    ) THEN
      RAISE EXCEPTION 'New standard workplace % is missing from crew preferences', v_name;
    END IF;
  END LOOP;
END $$;

CREATE TEMP TABLE upt_new_workplace_fixture(
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO upt_new_workplace_fixture DEFAULT VALUES;

INSERT INTO auth.users(id,email)
SELECT owner_id,'standard-workplace-'||owner_id::text||'@test.invalid'
FROM upt_new_workplace_fixture;

-- The existing event trigger must automatically include the two standards.
INSERT INTO public.events(
  id,name,start_date,end_date,start_at,end_at,status,created_by
)
SELECT event_id,'Standard Lockers and Stage Managers CI event',
       now()+interval '2 hours',now()+interval '9 hours',
       now()+interval '2 hours',now()+interval '9 hours',
       'scheduled',owner_id
FROM upt_new_workplace_fixture;

DO $$
DECLARE
  v_event uuid:=(SELECT event_id FROM upt_new_workplace_fixture);
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.workplaces w
  JOIN public.workplace_catalog c ON c.id=w.catalog_workplace_id
  WHERE w.event_id=v_event
    AND w.is_active=true
    AND lower(trim(c.name)) IN ('lockers','stage managers')
    AND lower(trim(w.name))=lower(trim(c.name));

  IF v_count<>2 THEN
    RAISE EXCEPTION 'Expected exactly two linked and active new event workplaces, got %',v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workplaces w
    WHERE w.event_id=v_event
      AND lower(trim(w.name)) IN ('lockers','stage managers')
    GROUP BY lower(trim(w.name))
    HAVING count(*)<>1
  ) THEN
    RAISE EXCEPTION 'New event contains duplicated Lockers or Stage Managers workplaces';
  END IF;
END $$;

SELECT 'PASS: Lockers and Stage Managers are active, selectable and seeded into new events once' AS result;
ROLLBACK;
