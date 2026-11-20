-- Add carried_forward column to leave_balances
-- Tracks how many days were rolled over from the previous year

ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS carried_forward NUMERIC(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN leave_balances.carried_forward IS
    'Days rolled over from the previous year. Included in total.';
