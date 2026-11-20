-- Match the indexes already present in clean migration replays on older staging schemas.
CREATE INDEX IF NOT EXISTS training_progress_scenario_id_idx ON public.training_progress(scenario_id);
CREATE INDEX IF NOT EXISTS training_questions_participant_id_idx ON public.training_questions(participant_id);
CREATE INDEX IF NOT EXISTS training_scenario_members_user_id_idx ON public.training_scenario_members(user_id);
