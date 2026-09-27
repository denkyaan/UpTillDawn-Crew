-- UPTILLDAWN schema alignment
-- Align the existing minimal schema with the Crew Management application.
-- Existing data is preserved.

-- ============================================================
-- CANONICAL PROFILES BOOTSTRAP
-- ============================================================

-- Some historical installations already had public.profiles outside the
-- checked-in migration chain. A fresh install must be able to create the
-- canonical Crew profile surface before later alignment statements reference it.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  home_address TEXT,
  phone_number TEXT,
  date_of_birth DATE,
  national_register_number TEXT,
  iban TEXT,
  profile_photo_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'responsible_lead', 'admin'))
);

-- Preserve data when upgrading an installation that only has the legacy
-- StaffPortal profile table. Existing canonical profile rows are never replaced.
INSERT INTO public.profiles (
  id,
  updated_at,
  full_name,
  home_address,
  phone_number,
  date_of_birth,
  national_register_number,
  iban,
  profile_photo_url,
  approved,
  role
)
SELECT
  up.id,
  up.updated_at,
  up.full_name,
  up.address,
  up.phone,
  up.date_of_birth,
  up.national_register_number,
  up.iban,
  up.avatar_url,
  (up.account_status = 'approved'::account_status),
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = up.id
        AND ur.role = 'admin'::user_role
    ) THEN 'admin'
    ELSE 'staff'
  END
FROM public.user_profiles up
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EVENTS
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS gps_coordinates POINT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Brussels',
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_radius_m INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Production exposes event status as text. Historical clean installs may
-- still carry the old event_status enum, so converge before later policies/RPCs.
ALTER TABLE public.events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.events ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.events ALTER COLUMN status SET DEFAULT 'draft';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'start_date'
  ) THEN
    EXECUTE '
      UPDATE public.events
      SET start_at = COALESCE(start_at, start_date),
          start_date = COALESCE(start_date, start_at)
      WHERE start_at IS NULL OR start_date IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'end_date'
  ) THEN
    EXECUTE '
      UPDATE public.events
      SET end_at = COALESCE(end_at, end_date),
          end_date = COALESCE(end_date, end_at)
      WHERE end_at IS NULL OR end_date IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location'
  ) THEN
    EXECUTE '
      UPDATE public.events
      SET venue = COALESCE(venue, location),
          location = COALESCE(location, venue)
      WHERE venue IS NULL OR location IS NULL
    ';
  END IF;
END
$$;

ALTER TABLE public.events
  ALTER COLUMN start_at SET NOT NULL,
  ALTER COLUMN end_at SET NOT NULL,
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

-- ============================================================
-- WORKPLACES
-- ============================================================

ALTER TABLE public.workplaces
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS
  idx_upt_workplaces_event_name
ON public.workplaces(event_id, name);

-- ============================================================
-- EVENT MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_role TEXT NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id),
  CHECK (event_role IN ('employee', 'responsible_lead', 'admin'))
);

CREATE INDEX IF NOT EXISTS
  idx_event_members_event_user
ON public.event_members(event_id, user_id);

-- ============================================================
-- RESPONSIBLE ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.responsible_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  workplace_id UUID NOT NULL REFERENCES public.workplaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workplace_id, user_id)
);

CREATE INDEX IF NOT EXISTS
  idx_responsible_event_workplace
ON public.responsible_assignments(event_id, workplace_id, user_id);

-- ============================================================
-- SHIFTS
-- ============================================================

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role_name TEXT,
  ADD COLUMN IF NOT EXISTS responsible_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS overlap_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Production exposes shift status as text. Historical clean installs may
-- still carry the old shift_status enum. The legacy overlap trigger references
-- status, so detach it while changing the column type and recreate it afterward.
DROP TRIGGER IF EXISTS trg_prevent_shift_overlap ON public.shifts;

ALTER TABLE public.shifts ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.shifts ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.shifts ALTER COLUMN status SET DEFAULT 'scheduled';

CREATE OR REPLACE FUNCTION public.prevent_shift_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.overlap_allowed = false AND EXISTS (
    SELECT 1
    FROM public.shifts s
    WHERE s.user_id = NEW.user_id
      AND s.id <> NEW.id
      AND s.status <> 'cancelled'
      AND s.overlap_allowed = false
      AND tstzrange(s.scheduled_start,s.scheduled_end,'[)')
          && tstzrange(NEW.scheduled_start,NEW.scheduled_end,'[)')
  ) THEN
    RAISE EXCEPTION 'Shift overlaps an existing assignment';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_prevent_shift_overlap
BEFORE INSERT OR UPDATE OF user_id,scheduled_start,scheduled_end,overlap_allowed,status
ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_shift_overlap();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shifts'
      AND column_name = 'role'
  ) THEN
    EXECUTE '
      UPDATE public.shifts
      SET role_name = COALESCE(role_name, role, ''Crew'')
      WHERE role_name IS NULL
    ';
  ELSE
    UPDATE public.shifts
    SET role_name = 'Crew'
    WHERE role_name IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shifts'
      AND column_name = 'start_time'
  ) THEN
    EXECUTE '
      UPDATE public.shifts
      SET scheduled_start = COALESCE(scheduled_start, start_time),
          start_time = COALESCE(start_time, scheduled_start)
      WHERE scheduled_start IS NULL OR start_time IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shifts'
      AND column_name = 'end_time'
  ) THEN
    EXECUTE '
      UPDATE public.shifts
      SET scheduled_end = COALESCE(scheduled_end, end_time),
          end_time = COALESCE(end_time, scheduled_end)
      WHERE scheduled_end IS NULL OR end_time IS NULL
    ';
  END IF;
END
$$;

ALTER TABLE public.shifts
  ALTER COLUMN role_name SET DEFAULT 'Crew',
  ALTER COLUMN role_name SET NOT NULL,
  ALTER COLUMN scheduled_start SET NOT NULL,
  ALTER COLUMN scheduled_end SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL,
  ALTER COLUMN end_time SET NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_shifts_user_time
ON public.shifts(user_id, scheduled_start);

CREATE INDEX IF NOT EXISTS
  idx_shifts_event_workplace
ON public.shifts(event_id, workplace_id);

-- ============================================================
-- CHECK-INS
-- ============================================================

ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS gps_status TEXT NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS accuracy_m NUMERIC,
  ADD COLUMN IF NOT EXISTS distance_m NUMERIC,
  ADD COLUMN IF NOT EXISTS remote BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selfie_path TEXT,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'check_ins'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE '
      UPDATE public.check_ins
      SET requested_at = COALESCE(requested_at, created_at)
      WHERE requested_at IS NULL
    ';
  ELSE
    UPDATE public.check_ins
    SET requested_at = now()
    WHERE requested_at IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'check_ins'
      AND column_name = 'approved_at'
  ) THEN
    EXECUTE '
      UPDATE public.check_ins
      SET decided_at = COALESCE(decided_at, approved_at)
      WHERE decided_at IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'check_ins'
      AND column_name = 'approved_by'
  ) THEN
    EXECUTE '
      UPDATE public.check_ins
      SET decided_by = COALESCE(decided_by, approved_by)
      WHERE decided_by IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'check_ins'
      AND column_name = 'selfie_url'
  ) THEN
    EXECUTE '
      UPDATE public.check_ins
      SET selfie_path = COALESCE(selfie_path, selfie_url)
      WHERE selfie_path IS NULL
    ';
  END IF;
END
$$;

ALTER TABLE public.check_ins
  ALTER COLUMN requested_at SET DEFAULT now(),
  ALTER COLUMN requested_at SET NOT NULL;

-- The current QR flow records remote/contact-confirmed routing separately and
-- does not require a selfie path. Production no longer carries this legacy
-- pre-QR constraint, so remove it during canonical convergence.
ALTER TABLE public.check_ins
  DROP CONSTRAINT IF EXISTS check_ins_remote_selfie_required;

CREATE INDEX IF NOT EXISTS
  idx_checkins_event_user
ON public.check_ins(event_id, user_id);

-- ============================================================
-- CHECK-OUTS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.check_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT
);

-- ============================================================
-- WORK SESSIONS
-- ============================================================

ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS start_gps_status TEXT NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS stop_gps_status TEXT NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_sessions'
      AND column_name = 'start_time'
  ) THEN
    EXECUTE '
      UPDATE public.work_sessions
      SET started_at = COALESCE(started_at, start_time)
      WHERE started_at IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_sessions'
      AND column_name = 'end_time'
  ) THEN
    EXECUTE '
      UPDATE public.work_sessions
      SET ended_at = COALESCE(ended_at, end_time)
      WHERE ended_at IS NULL
    ';
  END IF;

  UPDATE public.work_sessions
  SET
    start_time = COALESCE(start_time, started_at),
    end_time = COALESCE(end_time, ended_at),
    started_at = COALESCE(started_at, start_time),
    ended_at = COALESCE(ended_at, end_time);

  UPDATE public.work_sessions
  SET status = 'active'
  WHERE ended_at IS NULL;

  UPDATE public.work_sessions
  SET status = 'completed'
  WHERE ended_at IS NOT NULL;
END
$$;

ALTER TABLE public.work_sessions
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  one_active_work_session
ON public.work_sessions(user_id)
WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS
  idx_work_sessions_event_user
ON public.work_sessions(event_id, user_id);

-- ============================================================
-- BREAK SESSIONS
-- ============================================================

ALTER TABLE public.break_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  UPDATE public.break_sessions b
  SET user_id = COALESCE(b.user_id, w.user_id)
  FROM public.work_sessions w
  WHERE w.id = b.work_session_id
    AND b.user_id IS NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'break_sessions'
      AND column_name = 'start_time'
  ) THEN
    EXECUTE '
      UPDATE public.break_sessions
      SET started_at = COALESCE(started_at, start_time)
      WHERE started_at IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'break_sessions'
      AND column_name = 'end_time'
  ) THEN
    EXECUTE '
      UPDATE public.break_sessions
      SET ended_at = COALESCE(ended_at, end_time)
      WHERE ended_at IS NULL
    ';
  END IF;

  UPDATE public.break_sessions
  SET
    start_time = COALESCE(start_time, started_at),
    end_time = COALESCE(end_time, ended_at),
    started_at = COALESCE(started_at, start_time),
    ended_at = COALESCE(ended_at, end_time);
END
$$;

ALTER TABLE public.break_sessions
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN started_at SET DEFAULT now(),
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN start_time SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  one_active_break
ON public.break_sessions(user_id)
WHERE ended_at IS NULL;

-- ============================================================
-- WORKPLACE TRANSITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workplace_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
  to_workplace_id UUID NOT NULL REFERENCES public.workplaces(id) ON DELETE RESTRICT,
  transitioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BRIEFINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  workplace_id UUID REFERENCES public.workplaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  required BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.briefing_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES public.briefings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(briefing_id, user_id, version)
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  workplace_id UUID REFERENCES public.workplaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  idx_tasks_event_workplace
ON public.tasks(event_id, workplace_id);

-- ============================================================
-- CHAT CHANNELS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (
    kind IN ('organization', 'event', 'workplace', 'private')
  ),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  workplace_id UUID REFERENCES public.workplaces(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_members (
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

-- Align existing messages table with channel-based chat.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      UPDATE public.messages
      SET sender_id = COALESCE(sender_id, user_id)
      WHERE sender_id IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'content'
  ) THEN
    EXECUTE '
      UPDATE public.messages
      SET body = COALESCE(body, content)
      WHERE body IS NULL
    ';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS
  idx_messages_channel_created
ON public.messages(channel_id, created_at);

-- Align existing message attachments.
ALTER TABLE public.message_attachments
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $
BEGIN
  UPDATE public.message_attachments
  SET
    file_url = COALESCE(file_url, storage_path),
    storage_path = COALESCE(storage_path, file_url);
END
$;

ALTER TABLE public.message_attachments
  ALTER COLUMN file_url SET NOT NULL,
  ALTER COLUMN storage_path DROP NOT NULL;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crew_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS public.upt_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OFFLINE OPERATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offline_operation_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

-- ============================================================
-- EVENT TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUTHORIZATION HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.upt_is_admin(
  uid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.approved = true
      AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.upt_is_responsible(
  event_uuid UUID,
  workplace_uuid UUID DEFAULT NULL,
  uid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.responsible_assignments ra
    JOIN public.profiles p ON p.id = ra.user_id
    WHERE ra.user_id = uid
      AND ra.event_id = event_uuid
      AND p.approved = true
      AND (
        workplace_uuid IS NULL
        OR ra.workplace_id = workplace_uuid
      )
  );
$$;

-- ============================================================
-- SHIFT OVERLAP PROTECTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_shift_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.overlap_allowed = false
     AND NEW.status <> 'cancelled'
     AND EXISTS (
       SELECT 1
       FROM public.shifts s
       WHERE s.user_id = NEW.user_id
         AND s.id <> NEW.id
         AND s.status <> 'cancelled'
         AND s.overlap_allowed = false
         AND tstzrange(
               s.scheduled_start,
               s.scheduled_end,
               '[)'
             )
             &&
             tstzrange(
               NEW.scheduled_start,
               NEW.scheduled_end,
               '[)'
             )
     )
  THEN
    RAISE EXCEPTION 'Shift overlaps an existing assignment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_shift_overlap
ON public.shifts;

CREATE TRIGGER trg_prevent_shift_overlap
BEFORE INSERT OR UPDATE OF
  user_id,
  scheduled_start,
  scheduled_end,
  overlap_allowed,
  status
ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_shift_overlap();

-- ============================================================
-- SERVER-AUTHORITATIVE WORK/BREAK FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.upt_start_work(
  p_event UUID,
  p_shift UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_members
    WHERE event_id = p_event
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not an event member';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.check_ins
    WHERE event_id = p_event
      AND user_id = auth.uid()
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Approved check-in required';
  END IF;

  IF p_shift IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.shifts
       WHERE id = p_shift
         AND event_id = p_event
         AND user_id = auth.uid()
         AND status <> 'cancelled'
     )
  THEN
    RAISE EXCEPTION 'Invalid shift';
  END IF;

  INSERT INTO public.work_sessions (
    event_id,
    user_id,
    shift_id,
    started_at,
    status
  )
  VALUES (
    p_event,
    auth.uid(),
    p_shift,
    now(),
    'active'
  )
  RETURNING id INTO wid;

  INSERT INTO public.upt_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    auth.uid(),
    'START_WORK',
    'work_session',
    wid
  );

  RETURN wid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upt_start_break(
  p_work_session UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.work_sessions
    WHERE id = p_work_session
      AND user_id = auth.uid()
      AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No active work session';
  END IF;

  INSERT INTO public.break_sessions (
    work_session_id,
    user_id,
    started_at
  )
  VALUES (
    p_work_session,
    auth.uid(),
    now()
  )
  RETURNING id INTO bid;

  INSERT INTO public.upt_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    auth.uid(),
    'START_BREAK',
    'break_session',
    bid
  );

  RETURN bid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upt_stop_break(
  p_break UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.break_sessions
  SET ended_at = now()
  WHERE id = p_break
    AND user_id = auth.uid()
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active break';
  END IF;

  INSERT INTO public.upt_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    auth.uid(),
    'STOP_BREAK',
    'break_session',
    p_break
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upt_stop_work(
  p_work_session UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.break_sessions
  SET ended_at = now()
  WHERE work_session_id = p_work_session
    AND user_id = auth.uid()
    AND ended_at IS NULL;

  UPDATE public.work_sessions
  SET
    ended_at = now(),
    status = 'completed'
  WHERE id = p_work_session
    AND user_id = auth.uid()
    AND ended_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active work session';
  END IF;

  INSERT INTO public.upt_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    auth.uid(),
    'STOP_WORK',
    'work_session',
    p_work_session
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upt_start_work(UUID, UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.upt_start_break(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.upt_stop_break(UUID) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.upt_stop_work(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upt_start_work(UUID, UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upt_start_break(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upt_stop_break(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upt_stop_work(UUID) TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.responsible_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.briefing_acknowledgements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.check_outs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.break_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workplace_transitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.crew_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.upt_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.offline_operation_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REMOVE OLD/INCOMPATIBLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS events_read ON public.events;

DROP POLICY IF EXISTS events_admin ON public.events;

DROP POLICY IF EXISTS workplaces_read ON public.workplaces;

DROP POLICY IF EXISTS workplaces_admin ON public.workplaces;

DROP POLICY IF EXISTS event_members_read ON public.event_members;

DROP POLICY IF EXISTS event_members_admin ON public.event_members;

DROP POLICY IF EXISTS responsible_read ON public.responsible_assignments;

DROP POLICY IF EXISTS responsible_admin ON public.responsible_assignments;

DROP POLICY IF EXISTS shifts_read ON public.shifts;

DROP POLICY IF EXISTS shifts_admin ON public.shifts;

DROP POLICY IF EXISTS incidents_read ON public.incidents;

DROP POLICY IF EXISTS incidents_create ON public.incidents;

DROP POLICY IF EXISTS incidents_manage ON public.incidents;

DROP POLICY IF EXISTS briefing_read ON public.briefings;

DROP POLICY IF EXISTS briefing_admin ON public.briefings;

DROP POLICY IF EXISTS ack_own ON public.briefing_acknowledgements;

DROP POLICY IF EXISTS task_read ON public.tasks;

DROP POLICY IF EXISTS task_manage ON public.tasks;

DROP POLICY IF EXISTS checkin_own_read ON public.check_ins;

DROP POLICY IF EXISTS checkin_own_insert ON public.check_ins;

DROP POLICY IF EXISTS checkin_manage ON public.check_ins;

DROP POLICY IF EXISTS checkout_access ON public.check_outs;

DROP POLICY IF EXISTS checkout_insert ON public.check_outs;

DROP POLICY IF EXISTS checkout_manage ON public.check_outs;

DROP POLICY IF EXISTS work_own_read ON public.work_sessions;

DROP POLICY IF EXISTS break_own_read ON public.break_sessions;

DROP POLICY IF EXISTS transition_own ON public.workplace_transitions;

DROP POLICY IF EXISTS notification_own ON public.crew_notifications;

DROP POLICY IF EXISTS notification_update ON public.crew_notifications;

DROP POLICY IF EXISTS audit_admin ON public.upt_audit_logs;

DROP POLICY IF EXISTS offline_own ON public.offline_operation_records;

DROP POLICY IF EXISTS templates_admin ON public.event_templates;

DROP POLICY IF EXISTS channels_read ON public.chat_channels;

DROP POLICY IF EXISTS messages_read ON public.messages;

DROP POLICY IF EXISTS messages_insert ON public.messages;

-- ============================================================
-- EVENTS / WORKPLACES
-- ============================================================

CREATE POLICY events_read
ON public.events
FOR SELECT
USING (
  public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = events.id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY events_admin
ON public.events
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

CREATE POLICY workplaces_read
ON public.workplaces
FOR SELECT
USING (
  public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = workplaces.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY workplaces_admin
ON public.workplaces
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

-- ============================================================
-- EVENT MEMBERS / RESPONSIBLES
-- ============================================================

CREATE POLICY event_members_read
ON public.event_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, NULL)
);

CREATE POLICY event_members_admin
ON public.event_members
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

CREATE POLICY responsible_read
ON public.responsible_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = responsible_assignments.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY responsible_admin
ON public.responsible_assignments
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

-- ============================================================
-- SHIFTS
-- ============================================================

CREATE POLICY shifts_read
ON public.shifts
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

CREATE POLICY shifts_admin
ON public.shifts
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

-- ============================================================
-- BRIEFINGS / ACKNOWLEDGEMENTS
-- ============================================================

CREATE POLICY briefing_read
ON public.briefings
FOR SELECT
USING (
  public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = briefings.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY briefing_manage
ON public.briefings
FOR ALL
USING (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
)
WITH CHECK (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

CREATE POLICY acknowledgement_own
ON public.briefing_acknowledgements
FOR ALL
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR public.upt_is_admin()
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE POLICY tasks_read
ON public.tasks
FOR SELECT
USING (
  public.upt_is_admin()
  OR assigned_user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = tasks.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY tasks_manage
ON public.tasks
FOR ALL
USING (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
)
WITH CHECK (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

-- ============================================================
-- CHECK-IN / CHECK-OUT
-- ============================================================

CREATE POLICY checkins_read
ON public.check_ins
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

CREATE POLICY checkins_insert
ON public.check_ins
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = check_ins.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY checkins_manage
ON public.check_ins
FOR UPDATE
USING (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
)
WITH CHECK (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

CREATE POLICY checkouts_read
ON public.check_outs
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, NULL)
);

CREATE POLICY checkouts_insert
ON public.check_outs
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = check_outs.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY checkouts_manage
ON public.check_outs
FOR UPDATE
USING (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, NULL)
)
WITH CHECK (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, NULL)
);

-- ============================================================
-- WORK / BREAK / TRANSITIONS
-- Writes happen through server-authoritative RPC functions.
-- ============================================================

CREATE POLICY work_sessions_read
ON public.work_sessions
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, NULL)
);

CREATE POLICY break_sessions_read
ON public.break_sessions
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
);

CREATE POLICY transitions_read
ON public.workplace_transitions
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.work_sessions ws
    WHERE ws.id = workplace_transitions.work_session_id
      AND public.upt_is_responsible(
        ws.event_id,
        workplace_transitions.to_workplace_id
      )
  )
);

-- ============================================================
-- NOTIFICATIONS / AUDIT / OFFLINE / TEMPLATES
-- ============================================================

CREATE POLICY notifications_read
ON public.crew_notifications
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.upt_is_admin()
);

CREATE POLICY notifications_update
ON public.crew_notifications
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY audit_admin
ON public.upt_audit_logs
FOR SELECT
USING (public.upt_is_admin());

CREATE POLICY offline_own
ON public.offline_operation_records
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY templates_admin
ON public.event_templates
FOR ALL
USING (public.upt_is_admin())
WITH CHECK (public.upt_is_admin());

-- ============================================================
-- CHAT
-- ============================================================

CREATE POLICY chat_channels_read
ON public.chat_channels
FOR SELECT
USING (
  public.upt_is_admin()

  OR EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.channel_id = chat_channels.id
      AND cm.user_id = auth.uid()
  )

  OR (
    kind = 'organization'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.approved = true
    )
  )

  OR (
    event_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.event_members em
      WHERE em.event_id = chat_channels.event_id
        AND em.user_id = auth.uid()
    )
  )
);

CREATE POLICY messages_read
ON public.messages
FOR SELECT
USING (
  public.upt_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.chat_channels c
    WHERE c.id = messages.channel_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.chat_members cm
          WHERE cm.channel_id = c.id
            AND cm.user_id = auth.uid()
        )
        OR (
          c.kind = 'organization'
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.approved = true
          )
        )
        OR (
          c.event_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.event_members em
            WHERE em.event_id = c.event_id
              AND em.user_id = auth.uid()
          )
        )
      )
  )
);

CREATE POLICY messages_insert
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.upt_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.chat_channels c
      WHERE c.id = messages.channel_id
        AND (
          EXISTS (
            SELECT 1
            FROM public.chat_members cm
            WHERE cm.channel_id = c.id
              AND cm.user_id = auth.uid()
          )
          OR (
            c.kind = 'organization'
            AND EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = auth.uid()
                AND p.approved = true
            )
          )
          OR (
            c.event_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.event_members em
              WHERE em.event_id = c.event_id
                AND em.user_id = auth.uid()
            )
          )
        )
    )
  )
);

-- ============================================================
-- INCIDENTS ALIGNMENT
-- ============================================================

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS responsible_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Preserve data from the existing incident schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incidents'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      UPDATE public.incidents
      SET reporter_id = COALESCE(reporter_id, user_id)
      WHERE reporter_id IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incidents'
      AND column_name = 'description'
  ) THEN
    EXECUTE '
      UPDATE public.incidents
      SET message = COALESCE(message, description)
      WHERE message IS NULL
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'incidents'
      AND column_name = 'photo_url'
  ) THEN
    EXECUTE '
      UPDATE public.incidents
      SET photo_path = COALESCE(photo_path, photo_url)
      WHERE photo_path IS NULL
    ';
  END IF;
END
$$;

ALTER TABLE public.incidents
  ALTER COLUMN reporter_id SET NOT NULL,
  ALTER COLUMN message SET NOT NULL;

-- Replace policies from migration 026 with policies matching
-- the aligned schema and the real profiles table.

DROP POLICY IF EXISTS incidents_read ON public.incidents;

DROP POLICY IF EXISTS incidents_create ON public.incidents;

DROP POLICY IF EXISTS incidents_manage ON public.incidents;

CREATE POLICY incidents_read
ON public.incidents
FOR SELECT
USING (
  reporter_id = auth.uid()
  OR public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);

CREATE POLICY incidents_create
ON public.incidents
FOR INSERT
WITH CHECK (
  reporter_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.event_members em
    WHERE em.event_id = incidents.event_id
      AND em.user_id = auth.uid()
  )
);

CREATE POLICY incidents_manage
ON public.incidents
FOR UPDATE
USING (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
)
WITH CHECK (
  public.upt_is_admin()
  OR public.upt_is_responsible(event_id, workplace_id)
);



-- ============================================================
-- CANONICAL PROFILE FOREIGN KEY CONVERGENCE
-- ============================================================
-- Historical Crew tables were originally created against the StaffPortal
-- user_profiles table. Production uses public.profiles for the active Crew
-- model. Rebuild those legacy foreign keys so clean installs converge with
-- production while leaving unrelated StaffPortal tables untouched.

ALTER TABLE public.events
  ALTER COLUMN created_by DROP NOT NULL;

DO $$
DECLARE
  fk record;
  delete_clause text;
BEGIN
  FOR fk IN
    SELECT *
    FROM (VALUES
      ('events','events_created_by_fkey','created_by','SET NULL'),
      ('event_members','event_members_user_id_fkey','user_id','CASCADE'),
      ('responsible_assignments','responsible_assignments_user_id_fkey','user_id','CASCADE'),
      ('responsible_assignments','responsible_assignments_assigned_by_fkey','assigned_by','SET NULL'),
      ('shifts','shifts_user_id_fkey','user_id','CASCADE'),
      ('shifts','shifts_responsible_lead_id_fkey','responsible_lead_id','SET NULL'),
      ('incidents','incidents_reporter_id_fkey','reporter_id','RESTRICT'),
      ('incidents','incidents_responsible_lead_id_fkey','responsible_lead_id','SET NULL'),
      ('incidents','incidents_acknowledged_by_fkey','acknowledged_by','SET NULL'),
      ('incidents','incidents_resolved_by_fkey','resolved_by','NO ACTION'),
      ('briefings','briefings_created_by_fkey','created_by','SET NULL'),
      ('briefing_acknowledgements','briefing_acknowledgements_user_id_fkey','user_id','CASCADE'),
      ('tasks','tasks_assigned_user_id_fkey','assigned_user_id','SET NULL'),
      ('tasks','tasks_created_by_fkey','created_by','SET NULL'),
      ('tasks','tasks_completed_by_fkey','completed_by','SET NULL'),
      ('check_ins','check_ins_user_id_fkey','user_id','CASCADE'),
      ('check_ins','check_ins_decided_by_fkey','decided_by','SET NULL'),
      ('check_outs','check_outs_user_id_fkey','user_id','CASCADE'),
      ('check_outs','check_outs_decided_by_fkey','decided_by','SET NULL'),
      ('work_sessions','work_sessions_user_id_fkey','user_id','CASCADE'),
      ('break_sessions','break_sessions_user_id_fkey','user_id','CASCADE'),
      ('workplace_transitions','workplace_transitions_user_id_fkey','user_id','CASCADE'),
      ('chat_members','chat_members_user_id_fkey','user_id','CASCADE'),
      ('messages','messages_sender_id_fkey','sender_id','RESTRICT'),
      ('messages','messages_moderated_by_fkey','moderated_by','SET NULL'),
      ('crew_notifications','crew_notifications_user_id_fkey','user_id','CASCADE'),
      ('upt_audit_logs','upt_audit_logs_actor_id_fkey','actor_id','SET NULL'),
      ('offline_operation_records','offline_operation_records_user_id_fkey','user_id','CASCADE'),
      ('event_templates','event_templates_created_by_fkey','created_by','SET NULL')
    ) AS v(table_name,constraint_name,column_name,on_delete)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name=fk.table_name
        AND column_name=fk.column_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
        fk.table_name,
        fk.constraint_name
      );

      delete_clause := CASE fk.on_delete
        WHEN 'NO ACTION' THEN ''
        ELSE ' ON DELETE ' || fk.on_delete
      END;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id)%s',
        fk.table_name,
        fk.constraint_name,
        fk.column_name,
        delete_clause
      );
    END IF;
  END LOOP;
END
$$;


-- ============================================================
-- CANONICAL STATUS TYPE CONVERGENCE
-- ============================================================
-- Historical clean installs created these Crew columns with enums. Production
-- exposes them as text, so convert them before later workflow migrations run.

-- Drop enum-bound consistency checks before converting approval_status to TEXT.
-- They are recreated immediately after conversion with identical semantics.
ALTER TABLE public.check_ins
  DROP CONSTRAINT IF EXISTS check_ins_decision_consistent;
ALTER TABLE public.check_outs
  DROP CONSTRAINT IF EXISTS check_outs_decision_consistent;

ALTER TABLE public.incidents ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.incidents ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.incidents ALTER COLUMN status SET DEFAULT 'open';

ALTER TABLE public.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.tasks ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'not_started';

ALTER TABLE public.check_ins ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.check_ins ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.check_ins ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.check_ins ALTER COLUMN gps_status DROP DEFAULT;
ALTER TABLE public.check_ins ALTER COLUMN gps_status TYPE TEXT USING gps_status::text;
ALTER TABLE public.check_ins ALTER COLUMN gps_status SET DEFAULT 'not_checked';

ALTER TABLE public.check_outs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.check_outs ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.check_outs ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.check_ins
  ADD CONSTRAINT check_ins_decision_consistent CHECK (
    (status='pending' AND decided_at IS NULL AND decided_by IS NULL) OR
    (status IN ('approved','rejected','cancelled') AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
  );

ALTER TABLE public.check_outs
  ADD CONSTRAINT check_outs_decision_consistent CHECK (
    (status='pending' AND decided_at IS NULL AND decided_by IS NULL) OR
    (status IN ('approved','rejected','cancelled') AND decided_at IS NOT NULL AND decided_by IS NOT NULL)
  );

ALTER TABLE public.work_sessions ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.work_sessions ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.work_sessions ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.work_sessions ALTER COLUMN start_gps_status DROP DEFAULT;
ALTER TABLE public.work_sessions ALTER COLUMN start_gps_status TYPE TEXT USING start_gps_status::text;
ALTER TABLE public.work_sessions ALTER COLUMN start_gps_status SET DEFAULT 'not_checked';
ALTER TABLE public.work_sessions ALTER COLUMN stop_gps_status DROP DEFAULT;
ALTER TABLE public.work_sessions ALTER COLUMN stop_gps_status TYPE TEXT USING stop_gps_status::text;
ALTER TABLE public.work_sessions ALTER COLUMN stop_gps_status SET DEFAULT 'not_checked';

ALTER TABLE public.offline_operation_records ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.offline_operation_records ALTER COLUMN status TYPE TEXT USING status::text;
ALTER TABLE public.offline_operation_records ALTER COLUMN status SET DEFAULT 'pending';
