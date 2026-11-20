-- Main-test non-admin Finance denial with disposable, rolled-back account.
BEGIN;
create temp table qa_finance_staff (id uuid primary key default gen_random_uuid());
insert into qa_finance_staff default values;
insert into auth.users(id,email) select id,'qa-finance-staff-'||id::text||'@example.invalid' from qa_finance_staff;
update public.profiles set role='staff',approved=true,account_blocked=false where id=(select id from qa_finance_staff);

SELECT set_config('request.jwt.claim.sub', (select id::text from qa_finance_staff), true);
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
  blocked := false;
  BEGIN
    INSERT INTO public.admin_financial_documents
      (kind,status,created_by,net_amount,tax_amount,currency)
      VALUES ('sales_invoice','draft',auth.uid(),100,21,'EUR');
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'Non-admin was allowed to create a financial document';
  END IF;
  RAISE NOTICE 'PASS: non-admin counterparty and financial document inserts denied by RLS';
END $$;
SELECT 'PASS: isolated staff denied Finance counterparty and document mutations' AS result;
ROLLBACK;
