-- ============================================================
-- StaffPortal — Migration 007: Fix Missing Admin Profile & RLS
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Create the missing admin@yourcompany.com profile if it doesn't exist
-- We pull the user ID directly from auth.users
INSERT INTO public.user_profiles (id, email, full_name, display_name, is_active, is_email_verified)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', 'Admin User'),
  COALESCE(raw_user_meta_data->>'full_name', 'Admin User'),
  true,
  true
FROM auth.users
WHERE email = 'admin@yourcompany.com'
ON CONFLICT (id) DO UPDATE SET
  is_active = true,
  is_email_verified = true,
  updated_at = now();

-- Step 2: Ensure admin@yourcompany.com has employee + admin + accounts roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'accounts' FROM auth.users WHERE email = 'admin@yourcompany.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Seed default leave balances for the admin user if missing
INSERT INTO public.leave_balances (user_id, leave_type, total, year)
SELECT u.id, lb.leave_type, lb.total, EXTRACT(YEAR FROM now())::int
FROM auth.users u
CROSS JOIN (VALUES 
  ('annual'::leave_type, 25),
  ('sick'::leave_type, 10),
  ('unpaid'::leave_type, 0)
) AS lb(leave_type, total)
WHERE u.email = 'admin@yourcompany.com'
ON CONFLICT (user_id, leave_type, year) DO NOTHING;

-- Step 4: Fix the directory RLS — allow all authenticated users to see ALL profiles
-- (not just is_active=true, so new signups appear immediately)
DROP POLICY IF EXISTS "authenticated: read basic directory" ON user_profiles;

CREATE POLICY "authenticated: read all profiles"
ON user_profiles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Step 5: Fix user_roles RLS — allow authenticated users to see all roles
-- (needed so the admin check in current_user_has_role works correctly)
DROP POLICY IF EXISTS "admin: read all roles" ON user_roles;

CREATE POLICY "authenticated: read all roles"
ON user_roles FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Step 6: Fix leave_balances — allow admin/accounts to read ALL balances
-- The existing policy uses current_user_has_role which now works correctly
-- after fixing the profile. But add a fallback for safety:
DROP POLICY IF EXISTS "accounts: read all leave balances" ON leave_balances;

CREATE POLICY "accounts: read all leave balances"
ON leave_balances FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    current_user_has_role('admin') OR current_user_has_role('accounts')
  )
);

-- Done!
SELECT 'Migration 007 complete' as status;
