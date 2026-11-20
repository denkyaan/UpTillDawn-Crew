-- Migration 015: Add wfh_type to wfh_records
-- Supports full-day, morning-only (AM), and afternoon-only (PM) WFH

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wfh_type') THEN
    CREATE TYPE wfh_type AS ENUM ('full', 'half_am', 'half_pm');
  END IF;
END $$;

ALTER TABLE wfh_records
  ADD COLUMN IF NOT EXISTS wfh_type wfh_type NOT NULL DEFAULT 'full';
