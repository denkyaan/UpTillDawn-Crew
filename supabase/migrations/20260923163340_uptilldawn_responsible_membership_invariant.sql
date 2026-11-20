-- A Responsible assignment implies event membership so the lead can participate
-- in the same operational workflows (shifts/check-in/tasks) without a second
-- manual admin step. Existing membership rows are preserved.
--
-- Historical clean installs still inherit event_role as the legacy user_role
-- enum. Production uses a text role surface that also supports
-- responsible_lead, so converge the column before seeding memberships.

ALTER TABLE public.event_members
  ALTER COLUMN event_role DROP DEFAULT;

ALTER TABLE public.event_members
  ALTER COLUMN event_role TYPE TEXT
  USING event_role::text;

ALTER TABLE public.event_members
  ALTER COLUMN event_role SET DEFAULT 'employee';

ALTER TABLE public.event_members
  DROP CONSTRAINT IF EXISTS event_members_event_role_check;

ALTER TABLE public.event_members
  ADD CONSTRAINT event_members_event_role_check
  CHECK (event_role IN ('employee', 'responsible_lead', 'admin'));

INSERT INTO public.event_members(event_id,user_id,event_role)
SELECT DISTINCT event_id,user_id,'responsible_lead'
FROM public.responsible_assignments
ON CONFLICT (event_id,user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.upt_ensure_responsible_event_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.event_members(event_id,user_id,event_role)
  VALUES (NEW.event_id,NEW.user_id,'responsible_lead')
  ON CONFLICT (event_id,user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.upt_ensure_responsible_event_member()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upt_ensure_responsible_event_member()
TO postgres, service_role;

DROP TRIGGER IF EXISTS upt_responsible_membership
ON public.responsible_assignments;
CREATE TRIGGER upt_responsible_membership
AFTER INSERT OR UPDATE OF event_id,user_id
ON public.responsible_assignments
FOR EACH ROW
EXECUTE FUNCTION public.upt_ensure_responsible_event_member();
