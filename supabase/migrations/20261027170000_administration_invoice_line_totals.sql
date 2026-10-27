-- Keep invoice totals authoritative once line items are entered.
-- Existing header-only draft documents retain their amounts until the first line.
create or replace function public.upt_admin_recalculate_financial_lines()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 target_id uuid := coalesce(new.document_id,old.document_id);
 calculated_net numeric(15,2);
 calculated_tax numeric(15,2);
begin
 select coalesce(round(sum(quantity * unit_price),2),0),
        coalesce(round(sum(round(quantity * unit_price * vat_rate / 100,2)),2),0)
 into calculated_net,calculated_tax
 from public.admin_financial_lines where document_id=target_id;
 update public.admin_financial_documents
 set net_amount=calculated_net,tax_amount=calculated_tax,updated_at=now()
 where id=target_id and status='draft';
 if not found then
  raise exception 'Invoice lines can only change while the document is draft';
 end if;
 return coalesce(new,old);
end;
$$;
drop trigger if exists upt_admin_financial_lines_recalculate on public.admin_financial_lines;
create trigger upt_admin_financial_lines_recalculate
after insert or update or delete on public.admin_financial_lines
for each row execute function public.upt_admin_recalculate_financial_lines();
revoke execute on function public.upt_admin_recalculate_financial_lines() from public,anon,authenticated;

-- Prevent header amounts from being changed independently of existing line items.
create or replace function public.upt_admin_guard_financial_header()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if tg_op='UPDATE' and (new.net_amount is distinct from old.net_amount or new.tax_amount is distinct from old.tax_amount)
 and exists(select 1 from public.admin_financial_lines where document_id=new.id)
 and pg_trigger_depth() <= 1 then
  raise exception 'Invoice totals are calculated from line items';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_financial_header_guard on public.admin_financial_documents;
create trigger upt_admin_financial_header_guard
before update on public.admin_financial_documents
for each row execute function public.upt_admin_guard_financial_header();
revoke execute on function public.upt_admin_guard_financial_header() from public,anon,authenticated;
