-- Emergency SQL Script to Reset Privileges and Unbrick RLS
-- Run this EXACTLY AS IS in the Supabase SQL Editor

-- 1. Restore the critical default permissions that were accidentally wiped
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Forcefully clean the slate for the problem tables
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE external_contacts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON user_roles;
DROP POLICY IF EXISTS "admin_accounts_read_all_balances" ON leave_balances;
DROP POLICY IF EXISTS "everyone_read_contacts" ON external_contacts;

-- 3. Re-enable RLS securely
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_contacts ENABLE ROW LEVEL SECURITY;

-- 4. Create the absolute simplest, unbreakable read policies for authenticated users
CREATE POLICY "allow_auth_read_profiles" ON user_profiles FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_read_roles" ON user_roles FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "allow_auth_read_contacts" ON external_contacts FOR SELECT TO authenticated USING (auth.role() = 'authenticated');

-- Leave balances remain slightly restricted to the owner or admins
CREATE POLICY "allow_owner_read_balances" ON leave_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_admin_read_balances" ON leave_balances FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'accounts'))
);
