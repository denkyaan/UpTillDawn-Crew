-- Ensure counterparty assignment matches the financial document's direction.
create or replace function public.upt_admin_guard_counterparty_kind()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare party_kind text;
begin
 if new.counterparty_id is null then return new; end if;
 select kind into party_kind from public.admin_counterparties where id=new.counterparty_id;
 if party_kind is null then raise exception 'Unknown counterparty'; end if;
 if new.kind='sales_invoice' and party_kind not in ('customer','both') then
  raise exception 'Sales invoices require a customer';
 end if;
 if new.kind='purchase_invoice' and party_kind not in ('supplier','both') then
  raise exception 'Purchase invoices require a supplier';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_counterparty_kind_guard on public.admin_financial_documents;
create trigger upt_admin_counterparty_kind_guard before insert or update on public.admin_financial_documents
 for each row execute function public.upt_admin_guard_counterparty_kind();
revoke execute on function public.upt_admin_guard_counterparty_kind() from public,anon,authenticated;
