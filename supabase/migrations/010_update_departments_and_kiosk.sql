-- Add visitor_phone to visitors table
ALTER TABLE visitors ADD COLUMN visitor_phone text;

-- Update Departments
-- First, any existing users with a department_id need to be temporarily set to NULL
-- to avoid foreign key violation when we delete the old departments.
UPDATE user_profiles SET department_id = NULL;

-- Delete all existing departments
DELETE FROM departments;

-- Insert new requested departments
INSERT INTO departments (name) VALUES
  ('Designer'),
  ('Sales'),
  ('Merchandiser'),
  ('QC'),
  ('C-suite'),
  ('Office Manager (reception)'),
  ('Accounts'),
  ('Logistics & IT');
