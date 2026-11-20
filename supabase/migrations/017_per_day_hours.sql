-- Migration 017: Per-day contracted hours
-- Adds hours_by_day JSONB to store per-weekday contracted hours.
-- e.g. { "mon": 8, "tue": 8, "wed": 8, "thu": 8, "fri": 4 }
-- daily_hours is kept as an average/fallback for backwards compat.

ALTER TABLE work_schedules
  ADD COLUMN IF NOT EXISTS hours_by_day JSONB DEFAULT NULL;
