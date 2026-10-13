-- Staging only. Run after verifying the Supabase project in the dashboard.
DO $$ BEGIN
 IF current_setting('app.settings.project_ref',true) IS DISTINCT FROM 'npbjrtiolqperdgljnhi' THEN
  RAISE EXCEPTION 'Staging project verification required';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.training_scenario_members (
 scenario_id uuid NOT NULL REFERENCES public.training_scenarios(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (scenario_id,user_id)
);
ALTER TABLE public.training_scenario_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_scenario_members FROM anon;
GRANT SELECT,INSERT,DELETE ON public.training_scenario_members TO authenticated;

CREATE POLICY training_members_read ON public.training_scenario_members FOR SELECT TO authenticated
 USING (user_id=auth.uid() OR EXISTS (
 SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()
 ));
CREATE POLICY training_members_owner_insert ON public.training_scenario_members FOR INSERT TO authenticated
 WITH CHECK (EXISTS (SELECT 1 FROM public.training_scenarios s
 WHERE s.id=scenario_id AND s.owner_id=auth.uid()));
CREATE POLICY training_members_owner_delete ON public.training_scenario_members FOR DELETE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.training_scenarios s
 WHERE s.id=scenario_id AND s.owner_id=auth.uid()));

DROP POLICY IF EXISTS training_scenarios_read ON public.training_scenarios;
CREATE POLICY training_scenarios_read ON public.training_scenarios FOR SELECT TO authenticated USING (
 owner_id=auth.uid() OR EXISTS (
 SELECT 1 FROM public.training_scenario_members m
 WHERE m.scenario_id=id AND m.user_id=auth.uid()
 ));
