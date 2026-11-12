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

-- Reuse the security-definer, locked, append-only batch importer verbatim except
-- for provider-specific category validation; do not add wallet mutation rights.
create or replace function public.upt_import_admin_provider_transactions(
 p_mapping uuid,p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_mapping public.admin_provider_event_mappings%rowtype;
 v_record public.admin_provider_transactions%rowtype;
 v_row jsonb;
 v_transaction_id text;
 v_category text;
 v_reference text;
 v_status text;
 v_amount bigint;
 v_time timestamptz;
 v_inserted integer := 0;
 v_skipped integer := 0;
 v_id uuid;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration permission required' using errcode='42501';
 end if;
 if p_mapping is null or p_rows is null or jsonb_typeof(p_rows)<>'array'
    or jsonb_array_length(p_rows) not between 1 and 500 then
  raise exception 'Invalid provider transaction batch' using errcode='22023';
 end if;
 select * into v_mapping from public.admin_provider_event_mappings
  where id=p_mapping and enabled=true for share;
 if not found then
  raise exception 'Provider event mapping is disabled or missing' using errcode='42501';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row)<>'object' or
    jsonb_typeof(v_row->'transactionId')<>'string' or
    jsonb_typeof(v_row->'category')<>'string' or
    jsonb_typeof(v_row->'status')<>'string' or
    jsonb_typeof(v_row->'amountCents')<>'number' or
    jsonb_typeof(v_row->'occurredAt')<>'string' then
   raise exception 'Invalid transaction fields' using errcode='22023';
  end if;
  v_transaction_id:=v_row->>'transactionId';
  v_category:=v_row->>'category';
  v_status:=v_row->>'status';
  v_reference:=nullif(v_row->>'saleReference','');
  if v_transaction_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'
    or (v_mapping.provider='eventpay' and v_category not in ('bar','merch','topups'))
    or (v_mapping.provider in ('eventix','sumup') and v_category not in ('tickets','merch','tokens'))
    or v_status not in ('paid','pending','refunded')
    or (v_reference is not null and v_reference !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$')
    or (v_row->>'amountCents') !~ '^[1-9][0-9]{0,10}$'
    or (v_row->>'occurredAt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
   raise exception 'Invalid transaction value' using errcode='22023';
  end if;
  v_amount:=(v_row->>'amountCents')::bigint;
  v_time:=(v_row->>'occurredAt')::timestamptz;
  select * into v_record from public.admin_provider_transactions
   where provider=v_mapping.provider and transaction_id=v_transaction_id and status=v_status
   for update;
  if found then
   if v_record.mapping_id<>v_mapping.id or v_record.event_id<>v_mapping.event_id
    or v_record.external_event_id<>v_mapping.external_event_id
    or v_record.category<>v_category or v_record.sale_reference is distinct from v_reference
    or v_record.amount_cents<>v_amount or v_record.occurred_at<>v_time then
    raise exception 'Conflicting provider transaction' using errcode='23505';
   end if;
   v_skipped:=v_skipped+1;
   continue;
  end if;
  v_id:=null;
  insert into public.admin_provider_transactions
   (mapping_id,provider,external_event_id,event_id,transaction_id,category,
    sale_reference,status,amount_cents,currency,occurred_at,imported_by)
  values
   (v_mapping.id,v_mapping.provider,v_mapping.external_event_id,v_mapping.event_id,
    v_transaction_id,v_category,v_reference,v_status,v_amount,'EUR',v_time,auth.uid())
  on conflict (provider,transaction_id,status) do nothing
  returning id into v_id;
  if v_id is not null then
   v_inserted:=v_inserted+1;
  else
   select * into v_record from public.admin_provider_transactions
    where provider=v_mapping.provider and transaction_id=v_transaction_id and status=v_status
    for update;
   if not found or v_record.mapping_id<>v_mapping.id or v_record.event_id<>v_mapping.event_id
    or v_record.external_event_id<>v_mapping.external_event_id
    or v_record.category<>v_category or v_record.sale_reference is distinct from v_reference
    or v_record.amount_cents<>v_amount or v_record.occurred_at<>v_time then
    raise exception 'Conflicting provider transaction' using errcode='23505';
   end if;
   v_skipped:=v_skipped+1;
  end if;
 end loop;
 return jsonb_build_object('inserted',v_inserted,'skipped',v_skipped);
end;
$$;
revoke all on function public.upt_import_admin_provider_transactions(uuid,jsonb) from public,anon;
grant execute on function public.upt_import_admin_provider_transactions(uuid,jsonb) to authenticated;
