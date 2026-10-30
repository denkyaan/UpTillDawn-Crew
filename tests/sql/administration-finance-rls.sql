-- Run on staging with two dedicated test accounts (admin and non-admin).
-- psql -v ON_ERROR_STOP=1 -v TEST_ADMIN_ID=<uuid> -v TEST_NON_ADMIN_ID=<uuid> -f tests/sql/administration-finance-rls.sql
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'TEST_NON_ADMIN_ID', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  blocked boolean := false;
BEGIN
  IF public.upt_is_admin() OR public.upt_can_manage_administration() THEN
    RAISE EXCEPTION 'Non-admin test account has administration access';
  END IF;
  BEGIN
    INSERT INTO public.admin_counterparties(name,kind)
      VALUES ('BUNDLE1 RLS ROLLBACK CUSTOMER','customer');
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Non-admin was allowed to create a financial counterparty';
  END IF;
  RAISE NOTICE 'PASS: non-admin counterparty insert denied by RLS';
END $$;
ROLLBACK;
