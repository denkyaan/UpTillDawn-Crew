-- Credit notes must reference a real original invoice and cannot exceed its remaining creditable value.
alter table public.admin_financial_documents
 add column if not exists original_invoice_id uuid references public.admin_financial_documents(id);
create index if not exists admin_financial_documents_original_invoice_idx on public.admin_financial_documents(original_invoice_id);

create or replace function public.upt_admin_guard_credit_note()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 original_record public.admin_financial_documents%rowtype;
 credited numeric(15,2);
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
  if new.gross_amount < 0 then
   raise exception 'Credit note amount must be non-negative';
  end if;
  if new.status in ('approved','issued','paid') then
   select coalesce(sum(gross_amount),0) into credited
   from public.admin_financial_documents
   where original_invoice_id=new.original_invoice_id and kind='credit_note'
    and status in ('approved','issued','paid') and id<>new.id;
   if credited+new.gross_amount>original_record.gross_amount then
    raise exception 'Credit note exceeds remaining invoice amount';
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
drop trigger if exists upt_admin_credit_note_guard on public.admin_financial_documents;
create trigger upt_admin_credit_note_guard
before insert or update on public.admin_financial_documents
for each row execute function public.upt_admin_guard_credit_note();
revoke execute on function public.upt_admin_guard_credit_note() from public,anon,authenticated;
