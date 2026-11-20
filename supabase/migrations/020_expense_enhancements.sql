-- Migration 020: Expense enhancements for the legacy expense module.
-- Keep historical upgrades when that module exists, but do not make it a fresh-install prerequisite.

DO $$
BEGIN
  IF to_regclass('public.expense_categories') IS NOT NULL
     AND to_regclass('public.expenses') IS NOT NULL THEN

    ALTER TABLE public.expense_categories
      ADD COLUMN IF NOT EXISTS gl_code TEXT;

    ALTER TABLE public.expenses
      ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

    ALTER TABLE public.expenses
      ADD COLUMN IF NOT EXISTS reimbursed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reimbursed_via TEXT,
      ADD COLUMN IF NOT EXISTS reimbursement_ref TEXT;

    CREATE TABLE IF NOT EXISTS public.expense_comments (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_id  UUID        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
      user_id     UUID        NOT NULL REFERENCES public.user_profiles(id),
      message     TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_expense_comments_expense
      ON public.expense_comments(expense_id);

    CREATE TABLE IF NOT EXISTS public.expense_audit_log (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_id  UUID        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
      user_id     UUID        NOT NULL REFERENCES public.user_profiles(id),
      action      TEXT        NOT NULL,
      changes     JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_expense_audit_expense
      ON public.expense_audit_log(expense_id);

    GRANT ALL ON public.expense_comments TO anon, authenticated, service_role;
    GRANT ALL ON public.expense_audit_log TO anon, authenticated, service_role;
  END IF;
END $$;
