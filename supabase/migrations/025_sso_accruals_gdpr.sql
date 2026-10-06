-- ============================================================
-- Migration 025: SSO domain mapping, leave-balance accruals,
--                GDPR export audit actions.
-- Idempotent. Safe to run more than once.
-- ============================================================

-- 1. New audit_action enum values used by the May-2026 features ----
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'sso_login';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'leave_accrued';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'gdpr_export';

-- 2. Leave-balance accruals --------------------------------------
-- accrual_rate is the number of days that accrue per calendar month.
-- accrued_to_date is the running total the accrual job has granted
-- this year so we never double-count when the cron runs again.
ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS accrual_rate NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS accrued_to_date NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE leave_balances
    ADD COLUMN IF NOT EXISTS last_accrued_on DATE;

COMMENT ON COLUMN leave_balances.accrual_rate IS
    'Days of leave that accrue per calendar month. 0 disables accrual for this balance.';
COMMENT ON COLUMN leave_balances.accrued_to_date IS
    'Running total of days granted by the accrual job this year. Guards against double-counting.';
COMMENT ON COLUMN leave_balances.last_accrued_on IS
    'Date the accrual job last topped up this balance.';

-- 3. SSO domain mapping ------------------------------------------
-- Maps an email domain to a Supabase auth provider so an
-- organisation can sign in with their identity provider.
-- provider is one of the Supabase OAuth providers (e.g. azure,
-- google) or the literal 'saml' for SAML 2.0 SSO.
CREATE TABLE IF NOT EXISTS sso_connections (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain        TEXT NOT NULL UNIQUE,
    provider      TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sso_connections IS
    'Maps an email domain to an SSO provider. Used to route staff to their identity provider at login.';

CREATE INDEX IF NOT EXISTS idx_sso_domain ON sso_connections(domain) WHERE is_active;

-- SSO connection rows are public-read so the login screen can
-- resolve the provider before a session exists. Writes are
-- service-role only (admin server actions).
ALTER TABLE sso_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sso_connections_read ON sso_connections;
CREATE POLICY sso_connections_read ON sso_connections
    FOR SELECT USING (true);
