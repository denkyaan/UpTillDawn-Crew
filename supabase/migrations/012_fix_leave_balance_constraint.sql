-- Fix: allow total = 0 for leave balances (e.g. sick/maternity/unpaid can have 0 days)
-- The previous CHECK (total > 0) silently rejected saves of 0, causing UI to show defaults
ALTER TABLE leave_balances DROP CONSTRAINT IF EXISTS check_total_positive;
ALTER TABLE leave_balances ADD CONSTRAINT check_total_not_negative CHECK (total >= 0);
