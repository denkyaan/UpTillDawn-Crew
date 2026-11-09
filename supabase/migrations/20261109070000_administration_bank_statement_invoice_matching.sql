-- Main-test Bank CSV intake and explicit Admin-approved matching to invoices.
-- Bank statement claims are NOT independently verified bank payments.
-- Never execute bank transfers, SEPA submissions, refunds, or external requests here.
create table if not exists public.admin_bank_statement_transactions (
 id uuid primary key default gen_random_uuid(),
 transaction_id text not null unique check (transaction_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'),
 booked_on date not null,
 direction text not null check (direction in ('credit','debit')),
 amount_cents bigint not null check (amount_cents between 1 and 99999999999),
 currency text not null default 'EUR' check (currency='EUR'),
 payment_reference text not null default '' check (length(payment_reference)<=200 and payment_reference !~ '[[:cntrl:]]'),
 description text not null default '' check (length(description)<=400 and description !~ '[[:cntrl:]]'),
 imported_by uuid not null references auth.users(id),
 imported_at timestamptz not null default now(),
 linked_document_id uuid references public.admin_financial_documents(id) on delete restrict,
 posted_payment_id uuid unique references public.admin_financial_payments(id) on delete restrict,
 posted_by uuid references auth.users(id),
 posted_at timestamptz,
 ignored_by uuid references auth.users(id),
 ignored_at timestamptz,
 ignored_reason text check (ignored_reason is null or length(trim(ignored_reason)) between 5 and 500),
 constraint admin_bank_posted_consistent check (
  (linked_document_id is null and posted_payment_id is null and posted_by is null and posted_at is null)
  or (linked_document_id is not null and posted_payment_id is not null and posted_by is not null and posted_at is not null)
 ),
 constraint admin_bank_ignored_consistent check (
  (ignored_by is null and ignored_at is null and ignored_reason is null)
  or (ignored_by is not null and ignored_at is not null and ignored_reason is not null)
 ),
 constraint admin_bank_single_resolution check (posted_at is null or ignored_at is null)
);
create index if not exists admin_bank_statement_imported_by_idx on public.admin_bank_statement_transactions(imported_by);
create index if not exists admin_bank_statement_linked_document_idx on public.admin_bank_statement_transactions(linked_document_id);
create index if not exists admin_bank_statement_posted_by_idx on public.admin_bank_statement_transactions(posted_by);
create index if not exists admin_bank_statement_ignored_by_idx on public.admin_bank_statement_transactions(ignored_by);
create index if not exists admin_bank_statement_booked_idx on public.admin_bank_statement_transactions(booked_on desc);
alter table public.admin_bank_statement_transactions enable row level security;
revoke all on public.admin_bank_statement_transactions from public,anon,authenticated;
grant select on public.admin_bank_statement_transactions to authenticated;
drop policy if exists admin_bank_statements_read on public.admin_bank_statement_transactions;
create policy admin_bank_statements_read on public.admin_bank_statement_transactions
 for select to authenticated using (public.upt_can_manage_administration());

-- One bank statement entry may settle at most one invoice and only through this
-- reserved internal payment reference. This index prevents double allocation even
-- if the manual payment form races an Admin reconciliation confirmation.
create unique index if not exists admin_bank_payment_reference_global_unique
 on public.admin_financial_payments(bank_reference)
 where bank_reference like 'BANKSTMT:%';

create or replace function public.upt_admin_import_bank_statement_transactions(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_row jsonb;
 v_id text;
 v_booked date;
 v_direction text;
 v_amount bigint;
 v_reference text;
 v_description text;
 v_existing public.admin_bank_statement_transactions%rowtype;
 v_new_id uuid;
 v_inserted integer := 0;
 v_skipped integer := 0;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration access required' using errcode='42501';
 end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array'
  or jsonb_array_length(p_rows) not between 1 and 500 then
  raise exception 'Invalid bank statement batch' using errcode='22023';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row)<>'object'
   or jsonb_typeof(v_row->'transactionId')<>'string'
   or jsonb_typeof(v_row->'bookedOn')<>'string'
   or jsonb_typeof(v_row->'direction')<>'string'
   or jsonb_typeof(v_row->'amountCents')<>'number'
   or jsonb_typeof(v_row->'paymentReference')<>'string'
   or jsonb_typeof(v_row->'description')<>'string'
  then raise exception 'Invalid bank row fields' using errcode='22023'; end if;
  v_id := v_row->>'transactionId';
  v_direction := v_row->>'direction';
  v_reference := v_row->>'paymentReference';
  v_description := v_row->>'description';
  if v_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$'
   or v_direction not in ('credit','debit')
   or (v_row->>'amountCents') !~ '^[1-9][0-9]{0,10}$'
   or (v_row->>'bookedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or length(v_reference)>200 or v_reference ~ '[[:cntrl:]]'
   or length(v_description)>400 or v_description ~ '[[:cntrl:]]'
  then raise exception 'Invalid bank row values' using errcode='22023'; end if;
  v_booked:=(v_row->>'bookedOn')::date;
  if to_char(v_booked,'YYYY-MM-DD')<>(v_row->>'bookedOn') then
   raise exception 'Invalid booking date' using errcode='22023';
  end if;
  v_amount:=(v_row->>'amountCents')::bigint;
  select * into v_existing from public.admin_bank_statement_transactions
   where transaction_id=v_id for update;
  if found then
   if v_existing.booked_on<>v_booked or v_existing.direction<>v_direction
    or v_existing.amount_cents<>v_amount or v_existing.payment_reference<>v_reference
    or v_existing.description<>v_description then
    raise exception 'Conflicting bank statement transaction' using errcode='23505';
   end if;
   v_skipped:=v_skipped+1;
   continue;
  end if;
  v_new_id:=null;
  insert into public.admin_bank_statement_transactions
   (transaction_id,booked_on,direction,amount_cents,currency,payment_reference,description,imported_by)
  values (v_id,v_booked,v_direction,v_amount,'EUR',v_reference,v_description,auth.uid())
  on conflict (transaction_id) do nothing returning id into v_new_id;
  if v_new_id is not null then
   v_inserted:=v_inserted+1;
  else
   select * into v_existing from public.admin_bank_statement_transactions
    where transaction_id=v_id for update;
   if not found or v_existing.booked_on<>v_booked or v_existing.direction<>v_direction
    or v_existing.amount_cents<>v_amount or v_existing.payment_reference<>v_reference
    or v_existing.description<>v_description then
    raise exception 'Conflicting bank statement transaction' using errcode='23505';
   end if;
   v_skipped:=v_skipped+1;
  end if;
 end loop;
 return jsonb_build_object('inserted',v_inserted,'skipped',v_skipped);
end;
$$;
revoke all on function public.upt_admin_import_bank_statement_transactions(jsonb) from public,anon;
grant execute on function public.upt_admin_import_bank_statement_transactions(jsonb) to authenticated;

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

create or replace function public.upt_admin_ignore_bank_statement(p_statement uuid,p_reason text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_statement public.admin_bank_statement_transactions%rowtype;
 v_reason text :=trim(coalesce(p_reason,''));
begin
 if auth.uid() is null or not public.upt_can_manage_administration() or not public.upt_is_admin() then
  raise exception 'Admin approval required' using errcode='42501';
 end if;
 if p_statement is null or length(v_reason) not between 5 and 500 then
  raise exception 'Reason between 5 and 500 characters required' using errcode='22023';
 end if;
 select * into v_statement from public.admin_bank_statement_transactions
  where id=p_statement for update;
 if not found or v_statement.posted_payment_id is not null then
  raise exception 'Cannot ignore a missing or posted statement' using errcode='23505';
 end if;
 if v_statement.ignored_at is not null then
  if v_statement.ignored_reason is distinct from v_reason then
   raise exception 'Ignored statement reason cannot change' using errcode='23505';
  end if;
  return jsonb_build_object('ignored',false,'statementId',p_statement);
 end if;
 update public.admin_bank_statement_transactions
 set ignored_by=auth.uid(),ignored_at=now(),ignored_reason=v_reason
 where id=p_statement;
 return jsonb_build_object('ignored',true,'statementId',p_statement);
end;
$$;
revoke all on function public.upt_admin_ignore_bank_statement(uuid,text) from public,anon;
grant execute on function public.upt_admin_ignore_bank_statement(uuid,text) to authenticated;
