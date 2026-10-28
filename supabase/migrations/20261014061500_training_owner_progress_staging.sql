-- Staging only: apply exclusively to Supabase project npbjrtiolqperdgljnhi.
-- This migration is already applied to that staging database.
DROP POLICY IF EXISTS training_progress_insert ON public.training_progress;
CREATE POLICY training_progress_insert ON public.training_progress FOR INSERT TO authenticated
 WITH CHECK (
  participant_id=auth.uid()
  AND (
   EXISTS(SELECT 1 FROM public.training_scenario_members m WHERE m.scenario_id=scenario_id AND m.user_id=auth.uid())
   OR (role='admin' AND EXISTS(SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()))
  )
 );
