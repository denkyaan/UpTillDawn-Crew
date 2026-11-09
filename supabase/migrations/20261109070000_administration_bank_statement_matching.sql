-- Manually imported bank statement observations; never initiates transfers or auto-posts payments.
-- Bank verification is a separate, Admin-only linkage to EXISTING ledger payments.
create table if not exists public.admin_bank_statement_entries(
 id uuid primary key default gen_random_uuid(),
 bank_account_iban text not null check(bank_account_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
 transaction_reference text not null check(transaction_reference ~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$'),
 booking_date date not null,
 amount_cents bigint not null check(amount_cents between -99999999999 and 99999999999 and amount_cents<>0),
 currency text not null default 'EUR' check(currency='EUR'),
 counterparty_iban text check(counterparty_iban is null or counterparty_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
 description text not null default '' check(length(description)<=500),
 imported_by uuid not null references auth.users(id),
 imported_at timestamptz not null default now(),
 unique(bank_account_iban,transaction_reference)
);
create index if not exists admin_bank_statement_entries_imported_by_idx
 on public.admin_bank_statement_entries(imported_by);
create index if not exists admin_bank_statement_entries_booking_idx
 on public.admin_bank_statement_entries(booking_date desc);
alter table public.admin_bank_statement_entries enable row level security;
revoke all on public.admin_bank_statement_entries from public,anon,authenticated;
grant select on public.admin_bank_statement_entries to authenticated;
drop policy if exists admin_bank_statement_entries_read on public.admin_bank_statement_entries;
create policy admin_bank_statement_entries_read on public.admin_bank_statement_entries
 for select to authenticated using (public.upt_can_manage_administration());

create table if not exists public.admin_bank_payment_matches(
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null unique references public.admin_bank_statement_entries(id) on delete restrict,
 payment_id uuid not null unique references public.admin_financial_payments(id) on delete restrict,
 approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now()
);
create index if not exists admin_bank_payment_matches_approved_by_idx
 on public.admin_bank_payment_matches(approved_by);
alter table public.admin_bank_payment_matches enable row level security;
revoke all on public.admin_bank_payment_matches from public,anon,authenticated;
grant select on public.admin_bank_payment_matches to authenticated;
drop policy if exists admin_bank_payment_matches_read on public.admin_bank_payment_matches;
create policy admin_bank_payment_matches_read on public.admin_bank_payment_matches
 for select to authenticated using (public.upt_can_manage_administration());

-- A single transaction imports the full file. Duplicate observations can be skipped,
-- conflicting observations abort and roll back all writes.
create or replace function public.upt_import_admin_bank_statement(
 p_bank_account_iban text,p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
 v_row jsonb;
 v_reference text;
 v_date date;
 v_amount bigint;
 v_iban text;
 v_description text;
 v_existing public.admin_bank_statement_entries%rowtype;
 v_new uuid;
 v_inserted integer:=0;
 v_skipped integer:=0;
begin
 if auth.uid() is null or not public.upt_can_manage_administration() then
  raise exception 'Administration permission required' using errcode='42501';
 end if;
 if p_bank_account_iban is null or
    p_bank_account_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' or
    p_rows is null or jsonb_typeof(p_rows)<>'array' or
    jsonb_array_length(p_rows) not between 1 and 250 then
  raise exception 'Invalid bank statement batch' using errcode='22023';
 end if;
 for v_row in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(v_row)<>'object' or
     jsonb_typeof(v_row->'transactionReference')<>'string' or
     jsonb_typeof(v_row->'bookingDate')<>'string' or
     jsonb_typeof(v_row->'amountCents')<>'number' or
     jsonb_typeof(v_row->'description')<>'string' then
   raise exception 'Invalid bank statement row' using errcode='22023';
  end if;
  v_reference:=v_row->>'transactionReference';
  v_description:=v_row->>'description';
  v_iban:=nullif(v_row->>'counterpartyIban','');
  if v_reference !~ '^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$' or
     (v_row->>'bookingDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or
     (v_row->>'amountCents') !~ '^(-?[1-9][0-9]{0,10})$' or
     length(v_description)>500 or
     (v_iban is not null and v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$') then
   raise exception 'Invalid bank statement fields' using errcode='22023';
  end if;
  v_date:=(v_row->>'bookingDate')::date;
  v_amount:=(v_row->>'amountCents')::bigint;
  if v_amount not between -99999999999 and 99999999999 or v_amount=0 then
   raise exception 'Invalid bank amount' using errcode='22023';
  end if;
  v_new:=null;
  insert into public.admin_bank_statement_entries
   (bank_account_iban,transaction_reference,booking_date,amount_cents,currency,
    counterparty_iban,description,imported_by)
  values(p_bank_account_iban,v_reference,v_date,v_amount,'EUR',v_iban,v_description,auth.uid())
  on conflict (bank_account_iban,transaction_reference) do nothing
  returning id into v_new;
  if v_new is not null then
   v_inserted:=v_inserted+1;
   continue;
  end if;
  select * into v_existing from public.admin_bank_statement_entries
   where bank_account_iban=p_bank_account_iban and transaction_reference=v_reference for update;
  if not found or v_existing.booking_date<>v_date
   or v_existing.amount_cents<>v_amount or v_existing.currency<>'EUR'
   or v_existing.counterparty_iban is distinct from v_iban
   or v_existing.description<>v_description then
   raise exception 'Conflicting bank statement entry' using errcode='23505';
  end if;
  v_skipped:=v_skipped+1;
 end loop;
 return jsonb_build_object('inserted',v_inserted,'skipped',v_skipped);
end;
$$;
revoke all on function public.upt_import_admin_bank_statement(text,jsonb) from public,anon;
grant execute on function public.upt_import_admin_bank_statement(text,jsonb) to authenticated;

-- Only an Admin can certify that an existing ledger payment appears on an imported
-- statement. This NEVER inserts or edits admin_financial_payments or invoice status.
create or replace function public.upt_admin_confirm_bank_payment_match(
 p_entry uuid,p_payment uuid
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
 v_entry public.admin_bank_statement_entries%rowtype;
 v_payment public.admin_financial_payments%rowtype;
 v_invoice public.admin_financial_documents%rowtype;
 v_match public.admin_bank_payment_matches%rowtype;
 v_expected bigint;
 v_candidate_count bigint;
 v_entry_count bigint;
 v_new uuid;
begin
 if auth.uid() is null or not public.upt_can_manage_administration()
    or not public.upt_is_admin() then
  raise exception 'Final bank matching requires Admin' using errcode='42501';
 end if;
 select * into v_entry from public.admin_bank_statement_entries where id=p_entry for update;
 if not found then
  raise exception 'Bank entry missing' using errcode='22023';
 end if;
 select * into v_payment from public.admin_financial_payments where id=p_payment;
 if not found then
  raise exception 'Payment missing' using errcode='22023';
 end if;
 select * into v_invoice from public.admin_financial_documents where id=v_payment.document_id;
 if not found or v_invoice.kind not in ('sales_invoice','purchase_invoice')
    or v_invoice.status not in ('approved','issued','paid') or v_invoice.currency<>'EUR' then
  raise exception 'Payment belongs to an ineligible invoice' using errcode='22023';
 end if;
 v_expected:=((v_payment.amount*100)::bigint) *
    (case when v_invoice.kind='purchase_invoice' then -1 else 1 end);
 if v_expected<>v_entry.amount_cents or
    v_payment.paid_on<>v_entry.booking_date or
    v_payment.bank_reference is distinct from v_entry.transaction_reference then
  raise exception 'Exact reference, date, amount or direction mismatch' using errcode='22023';
 end if;
 -- More than one plausible payment or bank line must never be confirmed
 -- through the RPC, including calls that bypass the UI suggestion filter.
 select count(*) into v_candidate_count
 from public.admin_financial_payments p
 join public.admin_financial_documents d on d.id=p.document_id
 where p.bank_reference=v_entry.transaction_reference
   and p.paid_on=v_entry.booking_date
   and d.kind in ('sales_invoice','purchase_invoice')
   and d.status in ('approved','issued','paid') and d.currency='EUR'
   and ((p.amount*100)::bigint) *
     (case when d.kind='purchase_invoice' then -1 else 1 end)=v_entry.amount_cents;
 select count(*) into v_entry_count
 from public.admin_bank_statement_entries e
 where e.transaction_reference=v_entry.transaction_reference
   and e.booking_date=v_entry.booking_date
   and e.amount_cents=v_entry.amount_cents;
 if v_candidate_count<>1 or v_entry_count<>1 then
  raise exception 'Ambiguous bank-to-ledger identity' using errcode='22023';
 end if;
 select * into v_match from public.admin_bank_payment_matches
  where entry_id=p_entry or payment_id=p_payment for update;
 if found then
  if v_match.entry_id=p_entry and v_match.payment_id=p_payment then
   return v_match.id;
  end if;
  raise exception 'Bank entry or payment already matched' using errcode='23505';
 end if;
 insert into public.admin_bank_payment_matches(entry_id,payment_id,approved_by)
 values(p_entry,p_payment,auth.uid())
 returning id into v_new;
 return v_new;
exception
 when unique_violation then
  raise exception 'Bank entry or payment already matched' using errcode='23505';
end;
$$;
revoke all on function public.upt_admin_confirm_bank_payment_match(uuid,uuid) from public,anon;
grant execute on function public.upt_admin_confirm_bank_payment_match(uuid,uuid) to authenticated;
