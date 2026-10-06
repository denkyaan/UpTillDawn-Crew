-- Add reconciliation sign-off columns to the legacy bank_statements module when present.
-- The current UpTillDawn baseline does not create that legacy table on a fresh install.
DO $$
BEGIN
  IF to_regclass('public.bank_statements') IS NOT NULL THEN
    ALTER TABLE public.bank_statements
      ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES public.user_profiles(id);
  END IF;
END $$;
