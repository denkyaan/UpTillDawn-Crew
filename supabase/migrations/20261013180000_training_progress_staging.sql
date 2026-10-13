-- Staging-only migration: apply exclusively to project npbjrtiolqperdgljnhi.
DO $$ BEGIN
 IF current_setting('app.settings.project_ref',true) IS DISTINCT FROM 'npbjrtiolqperdgljnhi' THEN
  RAISE EXCEPTION 'Staging project verification required';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.training_progress (
 participant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 scenario_id uuid NOT NULL REFERENCES public.training_scenarios(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','responsible_lead','employee')),
 results jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(participant_id,scenario_id,role)
);
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_progress FROM anon;
GRANT SELECT,INSERT ON public.training_progress TO authenticated;
GRANT UPDATE(results,updated_at) ON public.training_progress TO authenticated;
CREATE POLICY training_progress_read ON public.training_progress FOR SELECT TO authenticated
 USING (participant_id=auth.uid() OR EXISTS(SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()));
CREATE POLICY training_progress_insert ON public.training_progress FOR INSERT TO authenticated
 WITH CHECK (participant_id=auth.uid() AND EXISTS(SELECT 1 FROM public.training_scenario_members m WHERE m.scenario_id=scenario_id AND m.user_id=auth.uid()));
CREATE POLICY training_progress_update ON public.training_progress FOR UPDATE TO authenticated
 USING (participant_id=auth.uid()) WITH CHECK (participant_id=auth.uid());
