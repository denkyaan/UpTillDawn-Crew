-- ============================================================
-- Migration 006: Fix audit_action enum + contacts trigger
-- Run this in your Supabase SQL editor.
-- ============================================================

-- 1. Add missing audit_action enum values used in application code
--    (These were missing from the original 001 schema)
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'leave_balance_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_activated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_deactivated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'approver_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contact_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contact_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'calendar_event_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'calendar_event_deleted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'kiosk_pin_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'correction_applied';

-- 2. Fix the external_contacts trigger — it referenced a non-existent function.
--    Drop the broken trigger and recreate with the correct function name.
DROP TRIGGER IF EXISTS set_external_contacts_updated_at ON public.external_contacts;

CREATE TRIGGER set_external_contacts_updated_at
  BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3. Add UNIQUE constraint on visitor reference_code (belt-and-suspenders for concurrent bookings)
--    Already set in migration 001 (reference_code TEXT NOT NULL UNIQUE), so this is a no-op safety check.
-- (No change needed here — already unique in schema)

-- 4. Add index on leave_balances for common query pattern
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_type_year
  ON public.leave_balances(user_id, leave_type, year);

-- 5. Add index on user_approvers for the common lookup (find approver for a user)
CREATE INDEX IF NOT EXISTS idx_user_approvers_user_priority
  ON public.user_approvers(user_id, priority);

-- 6. Add ACCOUNTS_NOTIFY_EMAIL support: store accounts notification email in settings
--    (Optional: configure as Vercel env var ACCOUNTS_NOTIFY_EMAIL instead)
