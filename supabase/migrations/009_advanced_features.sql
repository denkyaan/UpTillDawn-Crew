-- Advanced Features Schema Update (Checkpoint 6)

-- 1. Add gender column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- 2. Add new leave types to the enum
-- In Postgres, ALTER TYPE ADD VALUE cannot run inside a transaction block easily if used with IF NOT EXISTS logic without a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'leave_type' AND e.enumlabel = 'maternity'
  ) THEN
    ALTER TYPE leave_type ADD VALUE 'maternity';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'leave_type' AND e.enumlabel = 'paternity'
  ) THEN
    ALTER TYPE leave_type ADD VALUE 'paternity';
  END IF;
END $$;
