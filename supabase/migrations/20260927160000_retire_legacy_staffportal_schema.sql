-- Retire the historical StaffPortal schema after the Uptilldawn Crew model
-- has fully converged on public.profiles and text-based operational statuses.
-- Production no longer exposes these tables/types. Fresh installs must match it.

DROP TABLE IF EXISTS public.pr_attachments CASCADE;
DROP TABLE IF EXISTS public.pr_approvals CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.expense_comments CASCADE;
DROP TABLE IF EXISTS public.expense_audit_log CASCADE;

DROP TABLE IF EXISTS public.poll_votes CASCADE;
DROP TABLE IF EXISTS public.polls CASCADE;
DROP TABLE IF EXISTS public.notice_board_posts CASCADE;
DROP TABLE IF EXISTS public.sso_connections CASCADE;

DROP TABLE IF EXISTS public.forgotten_clockout_alerts CASCADE;
DROP TABLE IF EXISTS public.work_schedules CASCADE;
DROP TABLE IF EXISTS public.external_contacts CASCADE;

DROP TABLE IF EXISTS public.attendance_corrections CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.wfh_records CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;
DROP TABLE IF EXISTS public.visitors CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.diary_entries CASCADE;
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.user_approvers CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- No enum types remain in the canonical production public schema. CASCADE here
-- deliberately removes only stale legacy overloads/functions that still depend
-- on retired enums; active Crew functions use text/uuid/boolean primitives.
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.attendance_status CASCADE;
DROP TYPE IF EXISTS public.leave_type CASCADE;
DROP TYPE IF EXISTS public.leave_status CASCADE;
DROP TYPE IF EXISTS public.day_type CASCADE;
DROP TYPE IF EXISTS public.visitor_status CASCADE;
DROP TYPE IF EXISTS public.feedback_status CASCADE;
DROP TYPE IF EXISTS public.complaint_severity CASCADE;
DROP TYPE IF EXISTS public.complaint_status CASCADE;
DROP TYPE IF EXISTS public.calendar_event_type CASCADE;
DROP TYPE IF EXISTS public.audit_action CASCADE;
DROP TYPE IF EXISTS public.correction_status CASCADE;
DROP TYPE IF EXISTS public.correction_field CASCADE;
DROP TYPE IF EXISTS public.event_status CASCADE;
DROP TYPE IF EXISTS public.shift_status CASCADE;
DROP TYPE IF EXISTS public.incident_status CASCADE;
DROP TYPE IF EXISTS public.account_status CASCADE;
DROP TYPE IF EXISTS public.approval_status CASCADE;
DROP TYPE IF EXISTS public.task_status CASCADE;
DROP TYPE IF EXISTS public.gps_status CASCADE;
DROP TYPE IF EXISTS public.work_status CASCADE;
DROP TYPE IF EXISTS public.sync_status CASCADE;

NOTIFY pgrst, 'reload schema';
