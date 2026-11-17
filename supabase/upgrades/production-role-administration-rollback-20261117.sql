-- UpTillDawn production RPC rollback snapshot — captured 2026-11-17.
-- Production BEFORE patch had no administration event-draft RPC, and the
-- active-role implementation below (owner: postgres). This file is an
-- emergency *function-scoped* rollback, NOT a full database backup.
-- Run ONLY with a fresh operational approval, before updating the production
-- Worker, when the new RPC is not yet relied on by users. This rollback will
-- intentionally restore old Maker behavior; it is NOT a fix for the issue.
--
-- Baseline production SHA tag: 0334a0f8e576d169d3b860a0fa53e03963798b7f
-- Baseline active-role function pg_get_functiondef MD5:
-- 8ec846af135d9ac695a6fb73a129ccfa
-- Expected post-patch RPCs were reviewed in:
-- supabase/upgrades/production-role-administration-alignment-20261117.sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $before_undo$
BEGIN
 IF to_regprocedure('public.upt_current_effective_role()') IS NULL
   OR to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)') IS NULL
 THEN RAISE EXCEPTION 'Rollback refused: expected patched functions not present'; END IF;
 IF position('upt_private.is_app_owner' IN
   pg_get_functiondef('public.upt_current_effective_role()'::regprocedure)) = 0
 THEN RAISE EXCEPTION 'Rollback refused: effective-role body drifted'; END IF;
 IF position('a.revoked_at IS NULL' IN
   pg_get_functiondef('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)'::regprocedure)) = 0
 THEN RAISE EXCEPTION 'Rollback refused: draft-RPC body drifted'; END IF;
END;
$before_undo$;
-- Exact old production function captured from pg_get_functiondef().
CREATE OR REPLACE FUNCTION public.upt_current_effective_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.upt_effective_role(auth.uid());
$function$;
REVOKE ALL ON FUNCTION public.upt_current_effective_role()
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upt_current_effective_role()
 TO authenticated;
-- Drop ONLY the function that did not exist on production before this patch.
DROP FUNCTION public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text);
DO $after_undo$
BEGIN
 IF md5(pg_get_functiondef('public.upt_current_effective_role()'::regprocedure))
  <> '8ec846af135d9ac695a6fb73a129ccfa'
   OR to_regprocedure('public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Rollback verification failed'; END IF;
END;
$after_undo$;
SELECT pg_notify('pgrst','reload schema');
COMMIT;
