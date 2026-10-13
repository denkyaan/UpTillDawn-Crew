-- Staging-only migration: do not apply to production.
DO $$
BEGIN
 IF current_setting('app.settings.project_ref', true) IS DISTINCT FROM 'npbjrtiolqperdgljnhi'
    AND current_database() NOT LIKE '%npbjrtiolqperdgljnhi%' THEN
   RAISE NOTICE 'Training scenario migration requires explicit staging deployment verification';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.training_scenarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT 'Training scenario',
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT training_scenarios_payload_object CHECK (jsonb_typeof(payload) = 'object'),
 CONSTRAINT training_scenarios_payload_limit CHECK (octet_length(payload::text) <= 200000),
 CONSTRAINT training_scenarios_owner_unique UNIQUE(owner_id)
);
ALTER TABLE public.training_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_scenarios FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.training_scenarios TO authenticated;
CREATE POLICY training_scenarios_read ON public.training_scenarios FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid())
);
CREATE POLICY training_scenarios_admin_insert ON public.training_scenarios FOR INSERT TO authenticated WITH CHECK (
 owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')
);
CREATE POLICY training_scenarios_admin_update ON public.training_scenarios FOR UPDATE TO authenticated USING (
 owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')
) WITH CHECK (owner_id=auth.uid());
