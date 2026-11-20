-- Internal payment ledger: no bank connection, SEPA submission or external transfers.
create table if not exists public.admin_financial_payments (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 amount numeric(15,2) not null check (amount>0),
 paid_on date not null,
 bank_reference text check (length(bank_reference)<=200),
 note text check (length(note)<=1000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists admin_financial_payments_document_idx on public.admin_financial_payments(document_id);
create unique index if not exists admin_financial_payments_reference_unique
 on public.admin_financial_payments(document_id,bank_reference)
 where bank_reference is not null and bank_reference<>'';
alter table public.admin_financial_payments enable row level security;
revoke all on public.admin_financial_payments from anon;
grant select,insert on public.admin_financial_payments to authenticated;
create policy admin_financial_payments_read on public.admin_financial_payments
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_financial_payments_insert on public.admin_financial_payments
 for insert to authenticated with check (public.upt_can_manage_administration() and created_by=auth.uid());

create or replace function public.upt_admin_guard_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare doc public.admin_financial_documents%rowtype;
 paid_total numeric(15,2);
begin
 select * into doc from public.admin_financial_documents where id=new.document_id for update;
 if not found or doc.status not in ('approved','issued','paid') then
  raise exception 'Only approved financial documents can receive payments';
 end if;
 select coalesce(sum(amount),0) into paid_total from public.admin_financial_payments where document_id=new.document_id;
 if paid_total+new.amount>doc.gross_amount then
  raise exception 'Payment exceeds outstanding amount';
 end if;
 return new;
end;
$$;
create trigger upt_admin_payment_guard before insert on public.admin_financial_payments
 for each row execute function public.upt_admin_guard_payment();
revoke execute on function public.upt_admin_guard_payment() from public,anon,authenticated;

-- Payments are append-only; corrections require an explicit controlled workflow.
create or replace view public.admin_financial_payment_balances
with (security_invoker=true)
as select d.id as document_id,d.gross_amount,
 coalesce(sum(p.amount),0)::numeric(15,2) as paid_amount,
 (d.gross_amount-coalesce(sum(p.amount),0))::numeric(15,2) as outstanding_amount
 from public.admin_financial_documents d
 left join public.admin_financial_payments p on p.document_id=d.id
 group by d.id,d.gross_amount;
grant select on public.admin_financial_payment_balances to authenticated;
