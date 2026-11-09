-- Main-test financial safety: link an already-booked payment instead of duplicating it.
-- Uses the existing bank transaction and payment tables; no money transfer is performed.
-- All checks are enforced in the database for direct RPC callers as well as the UI.

create or replace function public.upt_admin_post_bank_statement_payment(p_statement uuid,p_document uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_statement public.admin_bank_statement_transactions%rowtype;
 v_document public.admin_financial_documents%rowtype;
 v_paid numeric(15,2);
 v_credited numeric(15,2);
 v_remaining numeric(15,2);
 v_amount numeric(15,2);
 v_payment_id uuid;
 v_bank_ref text;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() or not public.upt_is_admin() then
  raise exception 'Admin approval required' using errcode='42501';
 end if;
 if p_statement is null or p_document is null then
  raise exception 'Missing statement or invoice' using errcode='22023';
 end if;
 select * into v_statement from public.admin_bank_statement_transactions
  where id=p_statement for update;
 if not found then raise exception 'Bank statement not found' using errcode='22023'; end if;
 if v_statement.posted_payment_id is not null then
  if v_statement.linked_document_id<>p_document then
   raise exception 'Statement is already linked to another invoice' using errcode='23505';
  end if;
  return jsonb_build_object('created',false,'paymentId',v_statement.posted_payment_id,'documentId',p_document);
 end if;
 if v_statement.ignored_at is not null then
  raise exception 'Ignored bank statement cannot be posted' using errcode='23505';
 end if;
 select * into v_document from public.admin_financial_documents
  where id=p_document for update;
 if not found or v_document.status not in ('approved','issued')
   or v_document.currency<>'EUR'
   or (v_statement.direction='credit' and v_document.kind<>'sales_invoice')
   or (v_statement.direction='debit' and v_document.kind<>'purchase_invoice') then
  raise exception 'Bank direction does not match an approved invoice' using errcode='22023';
 end if;
 select coalesce(sum(p.amount),0) into v_paid from public.admin_financial_payments p
  where p.document_id=v_document.id;
 select coalesce(sum(c.gross_amount),0) into v_credited from public.admin_financial_documents c
  where c.kind='credit_note' and c.original_invoice_id=v_document.id
   and c.status in ('approved','issued','paid');
 v_remaining:=v_document.gross_amount-v_paid-v_credited;
 v_amount:=v_statement.amount_cents::numeric/100;
 if v_remaining<=0 or v_amount>v_remaining then
  raise exception 'Bank payment exceeds invoice remaining balance' using errcode='22023';
 end if;
 -- A bank CSV can describe a payment already entered manually. Never post it
 -- a second time against the same invoice, date, amount and bank reference.
 -- Admin may reconcile such a payment with upt_admin_link_existing_bank_statement_payment.
 if exists (
  select 1 from public.admin_financial_payments p
  where p.document_id=v_document.id and p.paid_on=v_statement.booked_on
   and p.amount=v_amount
   and coalesce(p.bank_reference,'')=coalesce(v_statement.payment_reference,'')
 ) then
  raise exception 'Matching ledger payment already exists: link it instead of posting twice'
   using errcode='23505';
 end if;
 v_bank_ref:='BANKSTMT:'||v_statement.id::text;
 insert into public.admin_financial_payments
  (document_id,amount,paid_on,bank_reference,note,created_by)
 values (v_document.id,v_amount,v_statement.booked_on,v_bank_ref,
  'Approved matching to imported bank statement',auth.uid())
 returning id into v_payment_id;
 update public.admin_bank_statement_transactions
  set linked_document_id=v_document.id,posted_payment_id=v_payment_id,
   posted_by=auth.uid(),posted_at=now()
  where id=v_statement.id;
 return jsonb_build_object('created',true,'paymentId',v_payment_id,'documentId',p_document);
end;
$$;

revoke all on function public.upt_admin_post_bank_statement_payment(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_post_bank_statement_payment(uuid,uuid) to authenticated;

-- Link a manually registered payment to exactly one bank statement observation.
-- This never creates, updates or deletes a ledger payment or invoice.
create or replace function public.upt_admin_link_existing_bank_statement_payment(
 p_statement uuid,p_payment uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_statement public.admin_bank_statement_transactions%rowtype;
 v_payment public.admin_financial_payments%rowtype;
 v_document public.admin_financial_documents%rowtype;
 v_candidate_count bigint;
 v_expected numeric(15,2);
begin
 if auth.uid() is null or not public.upt_can_manage_administration()
   or not public.upt_is_admin() then
  raise exception 'Admin approval required' using errcode='42501';
 end if;
 if p_statement is null or p_payment is null then
  raise exception 'Statement and existing payment required' using errcode='22023';
 end if;
 select * into v_statement from public.admin_bank_statement_transactions
  where id=p_statement for update;
 if not found then raise exception 'Bank statement not found' using errcode='22023'; end if;
 if v_statement.posted_payment_id is not null then
  if v_statement.posted_payment_id=p_payment then
   return jsonb_build_object('linked',false,'paymentId',p_payment,
    'documentId',v_statement.linked_document_id);
  end if;
  raise exception 'Bank statement already resolved' using errcode='23505';
 end if;
 if v_statement.ignored_at is not null then
  raise exception 'Ignored bank statement cannot be matched' using errcode='23505';
 end if;
 if trim(v_statement.payment_reference)='' then
  raise exception 'Cannot verify an existing payment without a bank reference'
   using errcode='22023';
 end if;
 select * into v_payment from public.admin_financial_payments
  where id=p_payment for update;
 if not found then raise exception 'Existing payment not found' using errcode='22023'; end if;
 select * into v_document from public.admin_financial_documents
  where id=v_payment.document_id for update;
 if not found or v_document.status not in ('approved','issued','paid')
    or v_document.currency<>'EUR'
    or (v_statement.direction='credit' and v_document.kind<>'sales_invoice')
    or (v_statement.direction='debit' and v_document.kind<>'purchase_invoice') then
  raise exception 'Payment belongs to an ineligible invoice' using errcode='22023';
 end if;
 v_expected:=v_statement.amount_cents::numeric/100;
 if v_payment.amount<>v_expected or v_payment.paid_on<>v_statement.booked_on
    or v_payment.bank_reference is distinct from v_statement.payment_reference
    or v_payment.bank_reference like 'BANKSTMT:%' then
  raise exception 'Reference, date, direction or exact amount mismatch' using errcode='22023';
 end if;
 -- Do not guess which ledger payment is the correct one when duplicates exist.
 select count(*) into v_candidate_count
 from public.admin_financial_payments p
 join public.admin_financial_documents d on d.id=p.document_id
 where p.bank_reference=v_statement.payment_reference
   and p.paid_on=v_statement.booked_on and p.amount=v_expected
   and d.currency='EUR' and d.status in ('approved','issued','paid')
   and ((v_statement.direction='credit' and d.kind='sales_invoice')
    or (v_statement.direction='debit' and d.kind='purchase_invoice'));
 if v_candidate_count<>1 then
  raise exception 'Ambiguous existing ledger payment' using errcode='22023';
 end if;
 if exists (
  select 1 from public.admin_bank_statement_transactions
  where posted_payment_id=p_payment
 ) then
  raise exception 'Payment already linked to another bank statement' using errcode='23505';
 end if;
 update public.admin_bank_statement_transactions
  set linked_document_id=v_document.id,posted_payment_id=v_payment.id,
   posted_by=auth.uid(),posted_at=now()
  where id=v_statement.id;
 return jsonb_build_object('linked',true,'paymentId',v_payment.id,'documentId',v_document.id);
exception when unique_violation then
 raise exception 'Existing payment already linked' using errcode='23505';
end;
$$;
revoke all on function public.upt_admin_link_existing_bank_statement_payment(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_link_existing_bank_statement_payment(uuid,uuid) to authenticated;
