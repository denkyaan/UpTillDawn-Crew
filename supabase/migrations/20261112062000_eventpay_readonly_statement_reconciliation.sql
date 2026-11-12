-- EventPay statement reconciliation is an import-only integration.
-- Actual RFID/QR wallet balances, top-ups and charges remain in EventPay.
-- This does NOT configure payment credentials or enable any checkout/charge RPC.
-- Preserve the existing administration RLS, immutable provider mapping identity,
-- strict active-mapping check, append-only import and settlement approvals.

ALTER TABLE public.admin_provider_event_mappings
 DROP CONSTRAINT IF EXISTS admin_provider_event_mappings_provider_check;
ALTER TABLE public.admin_provider_event_mappings
 ADD CONSTRAINT admin_provider_event_mappings_provider_check
 CHECK (provider IN ('eventix','sumup','eventpay'));

ALTER TABLE public.admin_provider_transactions
 DROP CONSTRAINT IF EXISTS admin_provider_transactions_provider_check;
ALTER TABLE public.admin_provider_transactions
 ADD CONSTRAINT admin_provider_transactions_provider_check
 CHECK (provider IN ('eventix','sumup','eventpay'));

ALTER TABLE public.admin_provider_transactions
 DROP CONSTRAINT IF EXISTS admin_provider_transactions_category_check;
ALTER TABLE public.admin_provider_transactions
 ADD CONSTRAINT admin_provider_transactions_category_check
 CHECK (category IN ('tickets','merch','tokens','bar','topups'));

-- Prevent cross-provider reinterpretation of sales or prepaid reloads.
-- EventPay 'topups' represent acquired wallet liability, NEVER bar/merch revenue.
-- Keep prior Eventix/SumUp category semantics unchanged for compatibility.
ALTER TABLE public.admin_provider_transactions
 DROP CONSTRAINT IF EXISTS admin_provider_transactions_cashless_category_guard;
ALTER TABLE public.admin_provider_transactions
 ADD CONSTRAINT admin_provider_transactions_cashless_category_guard
 CHECK (
  (provider='eventpay' AND category IN ('bar','merch','topups'))
  OR
  (provider IN ('eventix','sumup') AND category IN ('tickets','merch','tokens'))
 );

COMMENT ON CONSTRAINT admin_provider_transactions_cashless_category_guard
 ON public.admin_provider_transactions
 IS 'EventPay topups are prepaid wallet funding, not POS revenue; no direct sales/stock/balance mutations.';
-- Keep bank-settlement provider check limited to Eventix/SumUp. EventPay
-- prepaid liabilities must not be automatically reconciled as normal sales.
-- No changes to existing bank settlement function or credentials.
