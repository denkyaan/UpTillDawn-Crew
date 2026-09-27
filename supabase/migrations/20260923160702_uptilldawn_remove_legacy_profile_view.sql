-- Remove the retired StaffPortal compatibility surface.
-- Historical databases may still have public.user_profiles as a table, while
-- later installations may expose it as a view. The active application uses
-- public.profiles directly, so remove whichever legacy object exists.

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
  ELSIF object_kind IN ('r', 'p') THEN
    EXECUTE 'DROP TABLE public.user_profiles';
  END IF;
END
$$;
