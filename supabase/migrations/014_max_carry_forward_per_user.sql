-- Add per-employee carry-forward cap to user_profiles
-- Default 5 days; admin/accounts can change per person

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS max_carry_forward SMALLINT NOT NULL DEFAULT 5;

COMMENT ON COLUMN user_profiles.max_carry_forward IS
    'Max days of unused annual leave this employee can carry forward at year-end.';

-- Also ensure carried_forward column exists on leave_balances (migration 013)
ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS carried_forward NUMERIC(5,2) NOT NULL DEFAULT 0;
