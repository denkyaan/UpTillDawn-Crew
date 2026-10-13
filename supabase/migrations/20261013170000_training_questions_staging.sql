-- Training questions: staging only; never execute against production.
DO $$ BEGIN
 IF current_setting('app.settings.project_ref',true) IS DISTINCT FROM 'npbjrtiolqperdgljnhi' THEN
  RAISE EXCEPTION 'Staging project verification required';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.training_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 scenario_id uuid NOT NULL REFERENCES public.training_scenarios(id) ON DELETE CASCADE,
 participant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','responsible_lead','employee')),
 question text NOT NULL CHECK (length(trim(question)) BETWEEN 1 AND 4000),
 answer text,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS training_questions_scenario_idx ON public.training_questions(scenario_id,created_at DESC);
ALTER TABLE public.training_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_questions FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.training_questions TO authenticated;
CREATE POLICY training_questions_read ON public.training_questions FOR SELECT TO authenticated
 USING (participant_id=auth.uid() OR EXISTS
 (SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()));
CREATE POLICY training_questions_insert ON public.training_questions FOR INSERT TO authenticated
 WITH CHECK (participant_id=auth.uid() AND status='open' AND answer IS NULL
 AND (EXISTS (SELECT 1 FROM public.training_scenario_members m
 WHERE m.scenario_id=scenario_id AND m.user_id=auth.uid())
 OR EXISTS (SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid())));
CREATE POLICY training_questions_admin_answer ON public.training_questions FOR UPDATE TO authenticated
 USING (EXISTS (SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()))
 WITH CHECK (EXISTS (SELECT 1 FROM public.training_scenarios s WHERE s.id=scenario_id AND s.owner_id=auth.uid()));
