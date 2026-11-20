-- PostgreSQL computes stored generated columns after BEFORE triggers.
-- Read net_amount + tax_amount rather than NEW.gross_amount in validation guards.
-- Without this, a paid invoice is always rejected and credit/review thresholds
-- can incorrectly evaluate as NULL.
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
  if (new.net_amount+new.tax_amount) is null or (new.net_amount+new.tax_amount)<0 then raise exception 'Credit note amount must be non-negative'; end if;
  if new.status in ('review','approved','issued','paid') and ((new.net_amount+new.tax_amount) is null or (new.net_amount+new.tax_amount)<=0) then
   raise exception 'Credit note amount must be positive before review';
  end if;
  if new.status in ('approved','issued','paid') then
   select coalesce(sum(gross_amount),0) into credited
   from public.admin_financial_documents
   where original_invoice_id=new.original_invoice_id and kind='credit_note'
    and status in ('approved','issued','paid') and id<>new.id;
   select coalesce(sum(amount),0) into paid_total
   from public.admin_financial_payments where document_id=new.original_invoice_id;
   if credited+paid_total+(new.net_amount+new.tax_amount)>original_record.gross_amount then
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
    if (new.net_amount+new.tax_amount) is null or (new.net_amount+new.tax_amount)<=0 or paid_total+credited_total<>(new.net_amount+new.tax_amount) then
     raise exception 'Invoice requires full credit-adjusted settlement before paid';
    end if;
   elsif (new.net_amount+new.tax_amount) is null or (new.net_amount+new.tax_amount)<=0 or paid_total<>(new.net_amount+new.tax_amount) then
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
revoke execute on function public.upt_admin_guard_financial_settlement() from public,anon,authenticated;

create or replace function public.upt_admin_require_invoice_review_fields()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.kind in ('sales_invoice','purchase_invoice') and new.status='review'
  and (tg_op='INSERT' or old.status is distinct from new.status) then
  if new.counterparty_id is null then
   raise exception 'Invoice requires a customer or supplier before review';
  end if;
  if new.document_number is null or btrim(new.document_number)='' then
   raise exception 'Invoice requires a document number before review';
  end if;
  if new.issue_date is null or new.due_date is null then
   raise exception 'Invoice requires issue and due dates before review';
  end if;
  if (new.net_amount+new.tax_amount) is null or (new.net_amount+new.tax_amount)<=0 then
   raise exception 'Invoice amount must be positive before review';
  end if;
 end if;
 return new;
end;
$$;
revoke execute on function public.upt_admin_require_invoice_review_fields() from public,anon,authenticated;
