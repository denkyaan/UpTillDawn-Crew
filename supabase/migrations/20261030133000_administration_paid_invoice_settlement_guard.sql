-- Enforce full credit-adjusted settlement at the database boundary.
-- A status update holds the invoice row lock, also used by payment and credit-note guards.
create or replace function public.upt_admin_require_paid_invoice_settlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 paid_total numeric(15,2);
 credited_total numeric(15,2);
begin
 if new.status='paid' and old.status is distinct from new.status
    and new.kind in ('sales_invoice','purchase_invoice') then
  if new.gross_amount is null or new.gross_amount<=0 then
   raise exception 'Paid invoice must have a positive gross amount';
  end if;
  select coalesce(sum(amount),0) into paid_total
   from public.admin_financial_payments where document_id=new.id;
  select coalesce(sum(gross_amount),0) into credited_total
   from public.admin_financial_documents
   where original_invoice_id=new.id and kind='credit_note'
    and status in ('approved','issued','paid');
  if paid_total+credited_total<>new.gross_amount then
   raise exception 'Paid invoice requires full credit-adjusted settlement';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_paid_invoice_settlement_guard on public.admin_financial_documents;
create trigger upt_admin_paid_invoice_settlement_guard
 before update on public.admin_financial_documents
 for each row execute function public.upt_admin_require_paid_invoice_settlement();
revoke execute on function public.upt_admin_require_paid_invoice_settlement() from public,anon,authenticated;
