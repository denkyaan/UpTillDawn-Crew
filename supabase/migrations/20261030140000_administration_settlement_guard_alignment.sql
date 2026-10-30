-- Consolidate the legacy settlement trigger with the credit-adjusted paid guard.
-- The legacy 20261027203000 trigger required full cash payment, incorrectly rejecting
-- an invoice settled by cash plus a valid approved credit note.
create or replace function public.upt_admin_guard_financial_settlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 paid_total numeric;
 credited_total numeric;
begin
 if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
  return new;
 end if;
 if new.status in ('paid','void') then
  select coalesce(sum(amount),0) into paid_total
   from public.admin_financial_payments where document_id=new.id;
  select coalesce(sum(gross_amount),0) into credited_total
   from public.admin_financial_documents where original_invoice_id=new.id
    and kind='credit_note' and status in ('approved','issued','paid');
  if new.status='paid' then
   if new.kind in ('sales_invoice','purchase_invoice') then
    if new.gross_amount is null or new.gross_amount<=0 or paid_total+credited_total<>new.gross_amount then
     raise exception 'Invoice requires full credit-adjusted settlement before paid';
    end if;
   elsif new.gross_amount is null or new.gross_amount<=0 or paid_total<>new.gross_amount then
    raise exception 'Document requires full payment before paid';
   end if;
  end if;
  if new.status='void' and (paid_total>0 or credited_total>0) then
   raise exception 'Documents with payments or approved credit notes cannot be voided';
  end if;
 end if;
 return new;
end;
$$;
-- The consolidated trigger covers the separate paid guard introduced earlier.
drop trigger if exists upt_admin_paid_invoice_settlement_guard on public.admin_financial_documents;
drop function if exists public.upt_admin_require_paid_invoice_settlement();
revoke execute on function public.upt_admin_guard_financial_settlement() from public,anon,authenticated;
