-- Enforce valid financial document dates at the database boundary.
alter table public.admin_financial_documents
 add constraint admin_financial_due_date_order
 check (due_date is null or (issue_date is not null and due_date>=issue_date));
create or replace function public.upt_admin_guard_invoice_dates()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.kind in ('sales_invoice','purchase_invoice') and new.status in ('approved','issued','paid') then
  if new.issue_date is null or new.due_date is null then
   raise exception 'Approved invoices require issue and due dates';
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_invoice_dates_guard on public.admin_financial_documents;
create trigger upt_admin_invoice_dates_guard before insert or update on public.admin_financial_documents
 for each row execute function public.upt_admin_guard_invoice_dates();
revoke execute on function public.upt_admin_guard_invoice_dates() from public,anon,authenticated;
