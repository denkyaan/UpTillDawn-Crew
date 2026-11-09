-- Standalone Admin financial lifecycle acceptance with disposable test identity.
-- All fixture changes, including test user, are rolled back after assertions.
BEGIN;
CREATE TEMP TABLE qa_finance_actor(id uuid primary key default gen_random_uuid());
INSERT INTO qa_finance_actor DEFAULT VALUES;
INSERT INTO auth.users(id,email) SELECT id,'qa-finance-'||id::text||'@example.invalid' FROM qa_finance_actor;
UPDATE public.profiles SET role='admin',approved=true,account_blocked=false WHERE id=(SELECT id FROM qa_finance_actor);
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM qa_finance_actor),true);
DO $$
DECLARE
  admin_id uuid := auth.uid();
  cp uuid;
  invoice_id uuid;
  credit_id uuid;
  failure text;
BEGIN
  IF NOT public.upt_is_admin() THEN
    RAISE EXCEPTION 'Expected approved test admin identity';
  END IF;
  INSERT INTO public.admin_counterparties(name,kind)
    VALUES ('BUNDLE1 ROLLBACK CUSTOMER','customer') RETURNING id INTO cp;
  INSERT INTO public.admin_financial_documents
    (kind,created_by,counterparty_id,document_number,issue_date,due_date,net_amount,tax_amount,currency,status)
    VALUES ('sales_invoice',admin_id,cp,'BUNDLE1-ROLLBACK-INV',current_date,current_date+14,100,21,'EUR','draft')
    RETURNING id INTO invoice_id;
  UPDATE public.admin_financial_documents SET status='review' WHERE id=invoice_id;
  BEGIN
    UPDATE public.admin_financial_documents SET status='paid' WHERE id=invoice_id;
    failure := 'ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    failure := SQLERRM;
  END;
  IF failure <> 'Invoice requires full credit-adjusted settlement before paid' THEN
    RAISE EXCEPTION 'Unexpected unpaid invoice result: %',failure;
  END IF;
  UPDATE public.admin_financial_documents
    SET status='approved',approved_by=admin_id,approved_at=now() WHERE id=invoice_id;
  BEGIN
    INSERT INTO public.admin_financial_payments(document_id,amount,paid_on,created_by)
      VALUES(invoice_id,122,current_date,admin_id);
    failure := 'ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    failure := SQLERRM;
  END;
  IF failure='ACCEPTED' THEN RAISE EXCEPTION 'Overpayment accepted'; END IF;
  INSERT INTO public.admin_financial_payments(document_id,amount,paid_on,created_by)
    VALUES(invoice_id,71,current_date,admin_id);
  INSERT INTO public.admin_financial_documents
    (kind,created_by,original_invoice_id,document_number,issue_date,due_date,net_amount,tax_amount,currency,status)
    VALUES('credit_note',admin_id,invoice_id,'BUNDLE1-ROLLBACK-CREDIT',current_date,current_date+14,50,0,'EUR','draft')
    RETURNING id INTO credit_id;
  UPDATE public.admin_financial_documents SET status='review' WHERE id=credit_id;
  UPDATE public.admin_financial_documents
    SET status='approved',approved_by=admin_id,approved_at=now() WHERE id=credit_id;
  UPDATE public.admin_financial_documents SET status='paid' WHERE id=invoice_id;
  IF (SELECT status FROM public.admin_financial_documents WHERE id=invoice_id) <> 'paid'
    THEN RAISE EXCEPTION 'Credit-adjusted invoice did not settle'; END IF;
  BEGIN
    UPDATE public.admin_financial_documents SET status='void' WHERE id=invoice_id;
    failure := 'ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    failure := SQLERRM;
  END;
  IF failure <> 'Documents with payments or approved credit notes cannot be voided' THEN
    RAISE EXCEPTION 'Unexpected void result: %',failure;
  END IF;
  RAISE NOTICE 'PASS: draft/review/approval, unpaid rejection, overpayment rejection, partial payment + credit, paid, void rejection';
END $$;
SELECT 'PASS: synthetic finance draft/review/approve, credit-adjusted partial settlement, overpayment/void denial' AS result;
ROLLBACK;
