-- UPTILLDAWN user_profiles view security
-- Ensure the compatibility surface respects caller permissions when it is a view.
-- Fresh installs may still have the historical public.user_profiles table at this point.

DO $$
DECLARE
  object_kind "char";
BEGIN
  SELECT c.relkind
  INTO object_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'user_profiles';

  IF object_kind = 'v' THEN
    EXECUTE 'ALTER VIEW public.user_profiles SET (security_invoker = true)';
  END IF;
END
$$;

-- Do not expose this compatibility surface anonymously.
REVOKE ALL ON public.user_profiles FROM anon;

-- Authenticated users may query it. If it is a security-invoker view,
-- public.profiles RLS remains authoritative. If it is still the legacy
-- table, its existing RLS policies remain authoritative.
GRANT SELECT ON public.user_profiles TO authenticated;
