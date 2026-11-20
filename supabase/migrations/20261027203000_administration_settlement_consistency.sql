-- A document may only become paid after its recorded payments cover its total.
-- Prevent voiding documents after any payment has been recorded.
create or replace function public.upt_admin_guard_financial_settlement()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare paid_total numeric(15,2);
begin
 if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
  return new;
 end if;
 if new.status in ('paid','void') then
  select coalesce(sum(amount),0) into paid_total
  from public.admin_financial_payments where document_id=new.id;
  if new.status='paid' and (new.gross_amount<=0 or paid_total<>new.gross_amount) then
   raise exception 'Document cannot be marked paid before its full amount is recorded';
  end if;
  if new.status='void' and paid_total>0 then
   raise exception 'Documents with recorded payments cannot be voided';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_financial_settlement_guard on public.admin_financial_documents;
create trigger upt_admin_financial_settlement_guard
before update on public.admin_financial_documents
for each row execute function public.upt_admin_guard_financial_settlement();
revoke execute on function public.upt_admin_guard_financial_settlement() from public,anon,authenticated;

-- Do not allow changing the original invoice amount after payment entries exist.
create or replace function public.upt_admin_guard_paid_amount()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if tg_op='UPDATE' and (new.net_amount is distinct from old.net_amount or new.tax_amount is distinct from old.tax_amount)
 and exists(select 1 from public.admin_financial_payments where document_id=new.id) then
  raise exception 'Financial amounts cannot change after payments are recorded';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_paid_amount_guard on public.admin_financial_documents;
create trigger upt_admin_paid_amount_guard before update on public.admin_financial_documents
for each row execute function public.upt_admin_guard_paid_amount();
revoke execute on function public.upt_admin_guard_paid_amount() from public,anon,authenticated;
