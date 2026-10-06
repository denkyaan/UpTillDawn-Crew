-- ============================================================
-- StaffPortal — Migration 001: Initial Schema
-- ============================================================
-- Run order: this must be the first migration.
-- All tables reference auth.users(id) via UUID.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('employee', 'admin', 'accounts', 'reception');

CREATE TYPE attendance_status AS ENUM (
  'present', 'absent', 'late', 'wfh', 'half_day', 'holiday', 'weekend'
);

CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'personal', 'compassionate', 'unpaid');

CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn');

CREATE TYPE day_type AS ENUM ('full', 'half_am', 'half_pm');

CREATE TYPE visitor_status AS ENUM ('booked', 'checked_in', 'checked_out', 'cancelled', 'expired', 'no_show');

CREATE TYPE feedback_status AS ENUM ('submitted', 'under_review', 'resolved', 'closed');

CREATE TYPE complaint_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE complaint_status AS ENUM ('submitted', 'investigating', 'resolved', 'closed');

CREATE TYPE calendar_event_type AS ENUM ('leave', 'wfh', 'visitor', 'holiday', 'early_leave', 'team');

CREATE TYPE audit_action AS ENUM (
  'user_created', 'user_updated', 'role_changed',
  'leave_submitted', 'leave_approved', 'leave_rejected', 'leave_cancelled',
  'clock_in', 'clock_out', 'break_start', 'break_end',
  'wfh_marked', 'visitor_created', 'visitor_checked_in', 'visitor_checked_out',
  'correction_submitted', 'correction_approved', 'correction_rejected',
  'password_reset', 'login', 'logout',
  'department_created', 'department_updated', 'department_deleted',
  'location_created', 'location_updated', 'location_deleted'
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  head_user_id UUID, -- FK added later after users table
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- LOCATIONS
-- ============================================================

CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  address     TEXT,
  city        TEXT,
  postcode    TEXT,
  capacity    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USER PROFILES
-- Extends auth.users. One row per authenticated user.
-- ============================================================

CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  display_name    TEXT,
  job_title       TEXT,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  desk_extension  TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add department head FK now that user_profiles exists
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head
  FOREIGN KEY (head_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- USER ROLES  (supports multiple roles per user)
-- ============================================================

CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Every user gets 'employee' role by default (handled by trigger)

-- ============================================================
-- APPROVERS MAPPING
-- Each employee can have up to 3 approvers.
-- ============================================================

CREATE TABLE user_approvers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  approver_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  priority      INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 3),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, approver_id),
  UNIQUE(user_id, priority)
);

-- ============================================================
-- ATTENDANCE
-- One record per work session (clock-in / clock-out pair)
-- ============================================================

CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  work_date       DATE NOT NULL,
  clock_in        TIMESTAMPTZ,
  clock_out       TIMESTAMPTZ,
  break_start     TIMESTAMPTZ,
  break_end       TIMESTAMPTZ,
  total_hours     NUMERIC(4,2),
  status          attendance_status NOT NULL DEFAULT 'present',
  early_leave     BOOLEAN NOT NULL DEFAULT false,
  early_leave_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date)
);

CREATE INDEX idx_attendance_user_date ON attendance(user_id, work_date DESC);

-- ============================================================
-- ATTENDANCE CORRECTIONS
-- ============================================================

CREATE TYPE correction_status AS ENUM ('submitted', 'approved', 'rejected', 'applied');
CREATE TYPE correction_field  AS ENUM ('clock_in', 'clock_out', 'break_start', 'break_end');

CREATE TABLE attendance_corrections (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attendance_id   UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  field           correction_field NOT NULL,
  original_value  TEXT,
  proposed_value  TEXT NOT NULL,
  reason          TEXT NOT NULL,
  status          correction_status NOT NULL DEFAULT 'submitted',
  reviewed_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WFH RECORDS
-- ============================================================

CREATE TABLE wfh_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  wfh_date    DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wfh_date)
);

CREATE INDEX idx_wfh_user_date ON wfh_records(user_id, wfh_date DESC);

-- ============================================================
-- LEAVE BALANCES
-- One row per user per leave type.
-- ============================================================

CREATE TABLE leave_balances (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  leave_type  leave_type NOT NULL,
  total       NUMERIC(5,2) NOT NULL DEFAULT 0,
  used        NUMERIC(5,2) NOT NULL DEFAULT 0,
  pending     NUMERIC(5,2) NOT NULL DEFAULT 0,
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type, year),
  CONSTRAINT check_used_not_negative  CHECK (used >= 0),
  CONSTRAINT check_pending_not_negative CHECK (pending >= 0),
  CONSTRAINT check_total_positive CHECK (total > 0)
);

-- Derived: remaining = total - used - pending (computed in queries)

-- ============================================================
-- LEAVE REQUESTS
-- ============================================================

CREATE TABLE leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  leave_type    leave_type NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  day_type      day_type NOT NULL DEFAULT 'full',
  days_count    NUMERIC(4,2) NOT NULL,
  reason        TEXT NOT NULL,
  status        leave_status NOT NULL DEFAULT 'pending',
  approver_id   UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (end_date >= start_date),
  CONSTRAINT check_days  CHECK (days_count > 0)
);

CREATE INDEX idx_leave_user       ON leave_requests(user_id, status);
CREATE INDEX idx_leave_approver   ON leave_requests(approver_id, status);
CREATE INDEX idx_leave_dates      ON leave_requests(start_date, end_date);

-- ============================================================
-- VISITORS
-- ============================================================

CREATE TABLE visitors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_user_id        UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  visitor_name        TEXT NOT NULL,
  visitor_email       TEXT NOT NULL,
  company             TEXT,
  purpose             TEXT NOT NULL,
  visit_date          DATE NOT NULL,
  time_window_start   TIME NOT NULL,
  time_window_end     TIME NOT NULL,
  location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
  guest_count         INTEGER NOT NULL DEFAULT 1,
  requires_id         BOOLEAN NOT NULL DEFAULT false,
  accessibility_notes TEXT,
  reference_code      TEXT NOT NULL UNIQUE,
  status              visitor_status NOT NULL DEFAULT 'booked',
  badge_number        TEXT,
  checked_in_at       TIMESTAMPTZ,
  checked_out_at      TIMESTAMPTZ,
  checked_in_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_time_window CHECK (time_window_end > time_window_start),
  CONSTRAINT check_guest_count CHECK (guest_count >= 1)
);

CREATE INDEX idx_visitors_date        ON visitors(visit_date);
CREATE INDEX idx_visitors_host        ON visitors(host_user_id);
CREATE INDEX idx_visitors_ref         ON visitors(reference_code);
CREATE INDEX idx_visitors_status_date ON visitors(status, visit_date);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  event_date      DATE NOT NULL,
  event_end_date  DATE,
  event_type      calendar_event_type NOT NULL,
  source_id       UUID,    -- FK to the originating record (leave_requests, wfh_records, etc.)
  source_table    TEXT,    -- 'leave_requests' | 'wfh_records' | 'visitors' etc.
  is_all_day      BOOLEAN NOT NULL DEFAULT true,
  is_company_wide BOOLEAN NOT NULL DEFAULT false,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cal_date      ON calendar_events(event_date);
CREATE INDEX idx_cal_user      ON calendar_events(user_id, event_date);
CREATE INDEX idx_cal_dept      ON calendar_events(department_id, event_date);

-- ============================================================
-- DIARY ENTRIES  (private per user)
-- ============================================================

CREATE TABLE diary_entries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT,
  tags        TEXT[] DEFAULT '{}',
  reminder_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diary_user ON diary_entries(user_id, created_at DESC);

-- ============================================================
-- FEEDBACK
-- ============================================================

CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  category    TEXT NOT NULL,
  status      feedback_status NOT NULL DEFAULT 'submitted',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPLAINTS
-- ============================================================

CREATE TABLE complaints (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- nullable for anonymous
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  severity      complaint_severity NOT NULL DEFAULT 'medium',
  category      TEXT NOT NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  status        complaint_status NOT NULL DEFAULT 'submitted',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT LOGS
-- Immutable — no UPDATE/DELETE allowed via RLS
-- ============================================================

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  actor_email   TEXT,
  action        audit_action NOT NULL,
  entity_table  TEXT NOT NULL,
  entity_id     UUID,
  before_data   JSONB,
  after_data    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_actor     ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity    ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_action    ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_created   ON audit_logs(created_at DESC);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

CREATE TABLE email_templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  subject       TEXT NOT NULL,
  html_body     TEXT NOT NULL,
  text_body     TEXT,
  category      TEXT NOT NULL DEFAULT 'general',
  variables     TEXT[] DEFAULT '{}',  -- list of {{variable}} keys used in template
  is_active     BOOLEAN NOT NULL DEFAULT true,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER  (auto-maintain updated_at on all tables)
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments', 'locations', 'user_profiles', 'attendance',
    'attendance_corrections', 'leave_balances', 'leave_requests',
    'visitors', 'diary_entries', 'feedback', 'complaints', 'email_templates'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()', t
    );
  END LOOP;
END;
$$;
