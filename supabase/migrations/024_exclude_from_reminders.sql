-- Add flag to exclude specific users from cron reminder emails
-- (e.g. staff on long-term unpaid leave who shouldn't get clock-in reminders)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS exclude_from_reminders BOOLEAN NOT NULL DEFAULT false;
