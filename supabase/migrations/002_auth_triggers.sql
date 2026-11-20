-- ============================================================
-- StaffPortal — Migration 002: Auth Triggers
-- Runs automatically when a user signs up via Supabase Auth
-- ============================================================

-- ============================================================
-- TRIGGER: New user signed up → create profile + default role
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_email TEXT := NEW.email;
  v_admin_email TEXT := current_setting('app.admin_email', true);
BEGIN
  -- 1. Enforce @yourcompany.com domain (belt-and-suspenders after client check)
  IF v_email NOT LIKE '%@yourcompany.com' THEN
    RAISE EXCEPTION 'Registration restricted to @yourcompany.com email addresses';
  END IF;

  -- 2. Create user profile
  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    display_name,
    is_email_verified
  ) VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL
  );

  -- 3. Assign default 'employee' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');

  -- 4. Auto-assign 'admin' if email matches the admin seed email
  IF v_email = COALESCE(v_admin_email, 'admin@yourcompany.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- 5. Seed default leave balances for the new user (current year)
  INSERT INTO public.leave_balances (user_id, leave_type, total, year)
  VALUES
    (NEW.id, 'annual',        25, EXTRACT(YEAR FROM now())),
    (NEW.id, 'sick',          10, EXTRACT(YEAR FROM now())),
    (NEW.id, 'personal',       5, EXTRACT(YEAR FROM now())),
    (NEW.id, 'compassionate',  5, EXTRACT(YEAR FROM now()));

  -- 6. Write audit log
  INSERT INTO public.audit_logs (
    actor_id, actor_email, action, entity_table, entity_id, after_data
  ) VALUES (
    NEW.id, v_email, 'user_created', 'user_profiles', NEW.id,
    jsonb_build_object('email', v_email, 'role', 'employee')
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: Email confirmed → update is_email_verified flag
-- ============================================================

CREATE OR REPLACE FUNCTION handle_email_confirmed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.user_profiles
    SET is_email_verified = true, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE FUNCTION handle_email_confirmed();

-- ============================================================
-- HELPER FUNCTION: Check if current user has a given role
-- Used in RLS policies throughout
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_has_role(check_role user_role)
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND   role    = check_role
  );
$$;

-- ============================================================
-- HELPER FUNCTION: Get all roles for current user
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS user_role[]
STABLE
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT ARRAY_AGG(role) FROM public.user_roles WHERE user_id = auth.uid();
$$;
