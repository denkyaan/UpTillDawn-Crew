-- Migration 016: Per-employee work schedules
-- Stores each employee's contracted working days and daily hours.
-- Defaults to Mon–Fri / 7.5h so nothing breaks for existing employees.

CREATE TABLE IF NOT EXISTS work_schedules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  work_days    TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  daily_hours  NUMERIC(4,2) NOT NULL DEFAULT 7.5,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS: employees can read/write their own; admins can read all
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own schedule read"   ON work_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own schedule write"  ON work_schedules FOR ALL    USING (auth.uid() = user_id);
