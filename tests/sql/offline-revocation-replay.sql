-- Regression: queued offline time-state operations must re-authorize at replay time.
-- A previously valid active session must not preserve mutation authority after
-- the user's event access/shift assignment has been revoked.
BEGIN;

CREATE TEMP TABLE upt_rev_ids(name text primary key, id uuid default gen_random_uuid());
INSERT INTO upt_rev_ids(name) VALUES
('staff'),('event'),('workplace'),('workplace2'),('shift'),('session'),
('break_op'),('transition_op');
GRANT SELECT ON upt_rev_ids TO authenticated;

INSERT INTO auth.users(id,email)
SELECT id,'offline-revocation@rollback.test'
FROM upt_rev_ids WHERE name='staff';

UPDATE public.profiles
SET approved=true, role='staff', full_name='Offline Revocation'
WHERE id=(SELECT id FROM upt_rev_ids WHERE name='staff');

INSERT INTO public.events(id,name,start_date,end_date,start_at,end_at,status,created_by)
VALUES(
 (SELECT id FROM upt_rev_ids WHERE name='event'),
 'Offline revocation rollback',
 now()-interval '1 hour', now()+interval '1 day',
 now()-interval '1 hour', now()+interval '1 day',
 'active',
 (SELECT id FROM upt_rev_ids WHERE name='staff')
);

UPDATE upt_rev_ids
SET id=(
  SELECT id FROM public.workplaces
  WHERE event_id=(SELECT id FROM upt_rev_ids WHERE name='event')
    AND name='Bar/Toog'
)
WHERE name='workplace';

INSERT INTO public.workplaces(id,event_id,name,sort_order)
VALUES(
 (SELECT id FROM upt_rev_ids WHERE name='workplace2'),
 (SELECT id FROM upt_rev_ids WHERE name='event'),
 'Revocation destination', 91
);

INSERT INTO public.event_members(event_id,user_id)
VALUES(
 (SELECT id FROM upt_rev_ids WHERE name='event'),
 (SELECT id FROM upt_rev_ids WHERE name='staff')
);

INSERT INTO public.shifts(
 id,event_id,workplace_id,user_id,role_name,start_time,end_time,
 scheduled_start,scheduled_end,status,confirmed_at,overlap_allowed
)
VALUES(
 (SELECT id FROM upt_rev_ids WHERE name='shift'),
 (SELECT id FROM upt_rev_ids WHERE name='event'),
 (SELECT id FROM upt_rev_ids WHERE name='workplace'),
 (SELECT id FROM upt_rev_ids WHERE name='staff'),
 'Revocation crew',
 now()-interval '30 minutes',now()+interval '4 hours',
 now()-interval '30 minutes',now()+interval '4 hours',
 'scheduled',now(),true
);

INSERT INTO public.work_sessions(id,event_id,user_id,shift_id,start_time,started_at,status)
VALUES(
 (SELECT id FROM upt_rev_ids WHERE name='session'),
 (SELECT id FROM upt_rev_ids WHERE name='event'),
 (SELECT id FROM upt_rev_ids WHERE name='staff'),
 (SELECT id FROM upt_rev_ids WHERE name='shift'),
 now()-interval '5 minutes',now()-interval '5 minutes','active'
);

-- Simulate operations that were queued while access was still valid, then revoke
-- all current event/shift authority before those operations reach the server.
DELETE FROM public.event_members
WHERE event_id=(SELECT id FROM upt_rev_ids WHERE name='event')
  AND user_id=(SELECT id FROM upt_rev_ids WHERE name='staff');

UPDATE public.shifts
SET status='cancelled'
WHERE id=(SELECT id FROM upt_rev_ids WHERE name='shift');

SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM upt_rev_ids WHERE name='staff'),true);
SET LOCAL ROLE authenticated;

DO $revocation$
BEGIN
  BEGIN
    PERFORM public.upt_sync_operation(
      (SELECT id FROM upt_rev_ids WHERE name='break_op'),
      'start_break',
      jsonb_build_object('session_id',(SELECT id FROM upt_rev_ids WHERE name='session'))
    );
    RAISE EXCEPTION 'FAIL revoked user replayed start_break';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='FAIL revoked user replayed start_break' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.upt_sync_operation(
      (SELECT id FROM upt_rev_ids WHERE name='transition_op'),
      'transition',
      jsonb_build_object(
        'session_id',(SELECT id FROM upt_rev_ids WHERE name='session'),
        'workplace_id',(SELECT id FROM upt_rev_ids WHERE name='workplace2')
      )
    );
    RAISE EXCEPTION 'FAIL revoked user replayed transition';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='FAIL revoked user replayed transition' THEN RAISE; END IF;
  END;

  IF EXISTS(
    SELECT 1 FROM public.offline_operation_records
    WHERE id IN (
      (SELECT id FROM upt_rev_ids WHERE name='break_op'),
      (SELECT id FROM upt_rev_ids WHERE name='transition_op')
    )
  ) THEN
    RAISE EXCEPTION 'FAIL revoked operations were persisted';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.break_sessions
    WHERE work_session_id=(SELECT id FROM upt_rev_ids WHERE name='session')
  ) THEN
    RAISE EXCEPTION 'FAIL revoked user created break state';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.workplace_transitions
    WHERE work_session_id=(SELECT id FROM upt_rev_ids WHERE name='session')
  ) THEN
    RAISE EXCEPTION 'FAIL revoked user created workplace transition';
  END IF;
END
$revocation$;

RESET ROLE;
SELECT 'PASS: offline replay re-authorizes after event/shift revocation' AS result;
ROLLBACK;
