-- Remove the retired StaffPortal compatibility view.
-- Historical fresh installs may still have public.user_profiles as the legacy
-- table referenced by older modules. That table must remain until those
-- foreign-key dependencies are explicitly migrated. Only remove the object
-- when it is actually a view.

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
    EXECUTE 'DROP VIEW public.user_profiles';
  END IF;
END
$$;
