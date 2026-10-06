-- Migration 022: Link legacy purchase requests to legacy expenses when both modules exist.
DO $$
BEGIN
  IF to_regclass('public.purchase_requests') IS NOT NULL
     AND to_regclass('public.expenses') IS NOT NULL THEN
    ALTER TABLE public.purchase_requests
      ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_purchase_requests_expense
      ON public.purchase_requests(expense_id);
  END IF;
END $$;
