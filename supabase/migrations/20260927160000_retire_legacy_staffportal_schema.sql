-- Retire the historical StaffPortal schema after the Uptilldawn Crew model
-- Retire auth/utility artifacts that belonged only to the historical StaffPortal.
DROP TRIGGER IF EXISTS on_auth_email_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_email_confirmed();

-- has fully converged on public.profiles and text-based operational statuses.
-- Production no longer exposes these tables/types. Fresh installs must match it.

DO $$
DECLARE
  unexpected text;
BEGIN
  SELECT string_agg(format('%s.%s', n.nspname, r.relname), ', ' ORDER BY n.nspname, r.relname)
  INTO unexpected
  FROM pg_constraint c
  JOIN pg_class target ON target.oid=c.confrelid
  JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace
  JOIN pg_class r ON r.oid=c.conrelid
  JOIN pg_namespace n ON n.oid=r.relnamespace
  WHERE c.contype='f'
    AND target_ns.nspname='public'
    AND target.relname='user_profiles'
    AND NOT (n.nspname='public' AND r.relname='user_profiles')
    AND NOT (
      n.nspname='public'
      AND r.relname = ANY(ARRAY[
        'departments','user_roles','user_approvers','attendance','attendance_corrections',
        'wfh_records','leave_balances','leave_requests','visitors','calendar_events',
        'diary_entries','feedback','complaints','audit_logs','email_templates',
        'external_contacts','work_schedules','forgotten_clockout_alerts','polls',
        'poll_votes','notice_board_posts','sso_connections','expense_comments',
        'expense_audit_log','purchase_requests','pr_approvals','pr_attachments'
      ])
    );

  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Active schema still references legacy user_profiles: %', unexpected;
  END IF;
END
$$;

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

-- These StaffPortal helpers were referenced by RLS policies/triggers on the
-- retired tables above. Drop them only after those dependencies are gone.
-- Intentionally no CASCADE: an unexpected active dependency must fail replay.
DROP FUNCTION IF EXISTS public.current_user_has_role(public.user_role);
DROP FUNCTION IF EXISTS public.current_user_roles();
DROP FUNCTION IF EXISTS public.trigger_set_updated_at();

DO $$
DECLARE
  unexpected text;
BEGIN
  SELECT string_agg(format('%s.%s.%s (%s)', ns.nspname, cls.relname, att.attname, typ.typname), ', ' ORDER BY ns.nspname, cls.relname, att.attname)
  INTO unexpected
  FROM pg_attribute att
  JOIN pg_class cls ON cls.oid=att.attrelid
  JOIN pg_namespace ns ON ns.oid=cls.relnamespace
  JOIN pg_type typ ON typ.oid=att.atttypid
  WHERE att.attnum>0
    AND NOT att.attisdropped
    AND ns.nspname='public'
    AND typ.typname = ANY(ARRAY[
      'user_role','attendance_status','leave_type','leave_status','day_type',
      'visitor_status','feedback_status','complaint_severity','complaint_status',
      'calendar_event_type','audit_action','correction_status','correction_field',
      'event_status','shift_status','incident_status','account_status','approval_status',
      'task_status','gps_status','work_status','sync_status'
    ]);

  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Active public columns still use retired enum types: %', unexpected;
  END IF;
END
$$;

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

-- Admin login success is called only after Supabase authentication succeeds.
-- Keep the two pre-auth guard/failure RPCs available to the login flow, but do
-- not let anonymous callers clear an existing admin lockout.
REVOKE EXECUTE ON FUNCTION public.upt_admin_login_success(text,text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.upt_admin_login_success(text,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
