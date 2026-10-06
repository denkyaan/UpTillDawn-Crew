-- ============================================================
-- StaffPortal — Migration 003: Row Level Security Policies
-- ============================================================
-- Principles:
--   1. Every table has RLS enabled
--   2. Admin sees everything
--   3. Users see only their own private data
--   4. Accounts role: read-only access to leave_balances
--   5. Reception role: read/write access to visitors only
--   6. audit_logs: insert only, no update/delete for anyone
-- ============================================================

-- ============================================================
-- USER_PROFILES
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "users: read own profile"
ON user_profiles FOR SELECT
USING (id = auth.uid());

-- Users can update their own profile (limited fields handled in app layer)
CREATE POLICY "users: update own profile"
ON user_profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "admin: read all profiles"
ON user_profiles FOR SELECT
USING (current_user_has_role('admin'));

-- Admin can insert/update profiles
CREATE POLICY "admin: manage profiles"
ON user_profiles FOR ALL
USING (current_user_has_role('admin'));

-- Authenticated users can read basic directory info (name, job_title, department, extension)
-- This is needed for the employee directory
CREATE POLICY "authenticated: read basic directory"
ON user_profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
);

-- ============================================================
-- USER_ROLES
-- ============================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
CREATE POLICY "users: read own roles"
ON user_roles FOR SELECT
USING (user_id = auth.uid());

-- Admin can read all roles
CREATE POLICY "admin: read all roles"
ON user_roles FOR SELECT
USING (current_user_has_role('admin'));

-- Admin can manage roles
CREATE POLICY "admin: manage roles"
ON user_roles FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- USER_APPROVERS
-- ============================================================

ALTER TABLE user_approvers ENABLE ROW LEVEL SECURITY;

-- Users can see their own approvers
CREATE POLICY "users: read own approvers"
ON user_approvers FOR SELECT
USING (user_id = auth.uid());

-- Users can see approvers where they ARE the approver (to know their responsibilities)
CREATE POLICY "users: read as approver"
ON user_approvers FOR SELECT
USING (approver_id = auth.uid());

-- Admin can manage all approvers
CREATE POLICY "admin: manage approvers"
ON user_approvers FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- DEPARTMENTS
-- ============================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read departments (needed for directory, filters)
CREATE POLICY "authenticated: read departments"
ON departments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admin can manage departments
CREATE POLICY "admin: manage departments"
ON departments FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- LOCATIONS
-- ============================================================

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated: read locations"
ON locations FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin: manage locations"
ON locations FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- ATTENDANCE
-- ============================================================

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Users read/write only their own attendance
CREATE POLICY "users: manage own attendance"
ON attendance FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin reads all attendance
CREATE POLICY "admin: read all attendance"
ON attendance FOR SELECT
USING (current_user_has_role('admin'));

-- Admin can update attendance (for corrections)
CREATE POLICY "admin: update attendance"
ON attendance FOR UPDATE
USING (current_user_has_role('admin'));

-- ============================================================
-- ATTENDANCE_CORRECTIONS
-- ============================================================

ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;

-- Users manage their own corrections
CREATE POLICY "users: manage own corrections"
ON attendance_corrections FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin manages all corrections
CREATE POLICY "admin: manage all corrections"
ON attendance_corrections FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- WFH_RECORDS
-- ============================================================

ALTER TABLE wfh_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: manage own wfh"
ON wfh_records FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin: read all wfh"
ON wfh_records FOR SELECT
USING (current_user_has_role('admin'));

-- ============================================================
-- LEAVE_BALANCES
-- ============================================================

ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;

-- Users read their own balances
CREATE POLICY "users: read own leave balances"
ON leave_balances FOR SELECT
USING (user_id = auth.uid());

-- Accounts role can read ALL leave balances (read-only)
CREATE POLICY "accounts: read all leave balances"
ON leave_balances FOR SELECT
USING (current_user_has_role('accounts'));

-- Admin can manage all leave balances
CREATE POLICY "admin: manage all leave balances"
ON leave_balances FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- LEAVE_REQUESTS
-- ============================================================

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Users manage their own requests
CREATE POLICY "users: manage own leave requests"
ON leave_requests FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Approvers can read requests assigned to them (to approve/reject)
CREATE POLICY "approvers: read assigned requests"
ON leave_requests FOR SELECT
USING (approver_id = auth.uid());

-- Approvers can UPDATE status on requests assigned to them
CREATE POLICY "approvers: update assigned requests"
ON leave_requests FOR UPDATE
USING (approver_id = auth.uid());

-- Accounts role: read-only on all leave requests
CREATE POLICY "accounts: read all leave requests"
ON leave_requests FOR SELECT
USING (current_user_has_role('accounts'));

-- Admin manages all
CREATE POLICY "admin: manage all leave requests"
ON leave_requests FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- VISITORS
-- ============================================================

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Hosts can manage their own visitor bookings
CREATE POLICY "users: manage own visitor bookings"
ON visitors FOR ALL
USING (host_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid());

-- Reception can read AND update all visitors
CREATE POLICY "reception: read all visitors"
ON visitors FOR SELECT
USING (current_user_has_role('reception'));

CREATE POLICY "reception: update visitors (check-in/out)"
ON visitors FOR UPDATE
USING (current_user_has_role('reception'));

-- Admin manages all visitors
CREATE POLICY "admin: manage all visitors"
ON visitors FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- CALENDAR_EVENTS
-- ============================================================

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Users read their own events
CREATE POLICY "users: read own calendar events"
ON calendar_events FOR ALL
USING (user_id = auth.uid());

-- All authenticated users read company-wide events
CREATE POLICY "authenticated: read company-wide events"
ON calendar_events FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_company_wide = true
);

-- Admin manages all events
CREATE POLICY "admin: manage all calendar events"
ON calendar_events FOR ALL
USING (current_user_has_role('admin'));

-- ============================================================
-- DIARY_ENTRIES  (strictly private)
-- ============================================================

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- ONLY the owner can access diary entries — not even admin
CREATE POLICY "users: full access own diary"
ON diary_entries FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FEEDBACK
-- ============================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users manage their own feedback
CREATE POLICY "users: manage own feedback"
ON feedback FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin reads all feedback
CREATE POLICY "admin: read all feedback"
ON feedback FOR SELECT
USING (current_user_has_role('admin'));

CREATE POLICY "admin: update feedback status"
ON feedback FOR UPDATE
USING (current_user_has_role('admin'));

-- ============================================================
-- COMPLAINTS
-- ============================================================

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- Non-anonymous: user reads their own
CREATE POLICY "users: read own complaints"
ON complaints FOR SELECT
USING (
  user_id = auth.uid()
  AND is_anonymous = false
);

-- Anyone authenticated can INSERT a complaint (including anonymous)
CREATE POLICY "authenticated: submit complaints"
ON complaints FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  -- If not anonymous, user_id must match the caller
  AND (is_anonymous = true OR user_id = auth.uid())
);

-- Admin sees ALL (including anonymous)
CREATE POLICY "admin: read all complaints"
ON complaints FOR SELECT
USING (current_user_has_role('admin'));

CREATE POLICY "admin: update complaint status"
ON complaints FOR UPDATE
USING (current_user_has_role('admin'));

-- ============================================================
-- AUDIT_LOGS  (append-only — no update/delete)
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin reads all audit logs
CREATE POLICY "admin: read audit logs"
ON audit_logs FOR SELECT
USING (current_user_has_role('admin'));

-- Server can insert audit logs (service role bypasses RLS — handled server-side)
-- No user-level insert policy: only backend/service role writes audit logs
-- No UPDATE or DELETE policies: immutable by design

-- ============================================================
-- EMAIL_TEMPLATES
-- ============================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Admin manages templates
CREATE POLICY "admin: manage email templates"
ON email_templates FOR ALL
USING (current_user_has_role('admin'));

-- All authenticated users can READ active templates (for system-generated emails)
-- NOTE: actual sending is always server-side
CREATE POLICY "authenticated: read active templates"
ON email_templates FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
);
