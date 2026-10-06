-- Add 'maternity' to the leave_type enum
-- This was missing, causing maternity leave balance saves to silently fail
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'maternity';

-- Seed the default maternity balance only after the enum value exists.
INSERT INTO public.leave_balances (user_id, leave_type, total, year)
SELECT id, 'maternity'::leave_type, 0, EXTRACT(YEAR FROM now())::int
FROM auth.users
WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, leave_type, year) DO NOTHING;
