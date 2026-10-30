-- A single invoice may not be settled beyond its gross total by payments and approved credits.
-- The original invoice row is locked by both guards, serializing concurrent writes.
create or replace function public.upt_admin_guard_payment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 doc public.admin_financial_documents%rowtype;
 paid_total numeric(15,2);
 credited_total numeric(15,2);
begin
 select * into doc from public.admin_financial_documents where id=new.document_id for update;
 if not found or doc.status not in ('approved','issued','paid') then
  raise exception 'Only approved financial documents can receive payments';
 end if;
 select coalesce(sum(amount),0) into paid_total from public.admin_financial_payments where document_id=new.document_id;
 select coalesce(sum(gross_amount),0) into credited_total
 from public.admin_financial_documents
 where original_invoice_id=new.document_id and kind='credit_note'
  and status in ('approved','issued','paid');
 if paid_total+credited_total+new.amount>doc.gross_amount then
  raise exception 'Payment exceeds credit-adjusted outstanding amount';
 end if;
 return new;
end;
$$;
revoke execute on function public.upt_admin_guard_payment() from public,anon,authenticated;

create or replace function public.upt_admin_guard_credit_note()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 original_record public.admin_financial_documents%rowtype;
 credited numeric(15,2);
 paid_total numeric(15,2);
begin
 if new.kind='credit_note' then
  if new.original_invoice_id is null or new.original_invoice_id=new.id then
   raise exception 'Credit note must reference an original invoice';
  end if;
  select * into original_record from public.admin_financial_documents
   where id=new.original_invoice_id for update;
  if not found or original_record.kind not in ('sales_invoice','purchase_invoice')
    or original_record.status not in ('approved','issued','paid') then
   raise exception 'Original invoice must be approved and valid';
  end if;
  if new.currency is distinct from original_record.currency then
   raise exception 'Credit note currency must match invoice';
  end if;
  if new.gross_amount<0 then raise exception 'Credit note amount must be non-negative'; end if;
  if new.status in ('approved','issued','paid') then
   select coalesce(sum(gross_amount),0) into credited
   from public.admin_financial_documents
   where original_invoice_id=new.original_invoice_id and kind='credit_note'
    and status in ('approved','issued','paid') and id<>new.id;
   select coalesce(sum(amount),0) into paid_total
   from public.admin_financial_payments where document_id=new.original_invoice_id;
   if credited+paid_total+new.gross_amount>original_record.gross_amount then
    raise exception 'Credit note exceeds credit-adjusted remaining invoice amount';
   end if;
  end if;
 elsif new.original_invoice_id is not null then
  raise exception 'Only credit notes may reference an original invoice';
 end if;
 if tg_op='UPDATE' and new.original_invoice_id is distinct from old.original_invoice_id then
  raise exception 'Original invoice reference cannot be changed';
 end if;
 return new;
end;
$$;
revoke execute on function public.upt_admin_guard_credit_note() from public,anon,authenticated;

create or replace view public.admin_financial_payment_balances
with (security_invoker=true)
as select d.id as document_id,d.gross_amount,
 coalesce(p.paid_amount,0)::numeric(15,2) as paid_amount,
 (d.gross_amount-coalesce(p.paid_amount,0)-coalesce(c.credited_amount,0))::numeric(15,2) as outstanding_amount
 from public.admin_financial_documents d
 left join lateral (
  select sum(amount) as paid_amount from public.admin_financial_payments
  where document_id=d.id
 ) p on true
 left join lateral (
  select sum(gross_amount) as credited_amount from public.admin_financial_documents
  where original_invoice_id=d.id and kind='credit_note'
   and status in ('approved','issued','paid')
 ) c on true;
grant select on public.admin_financial_payment_balances to authenticated;
