-- Preserve the meaning of linked sales and purchase invoices when counterparty roles change.
create or replace function public.upt_admin_guard_counterparty_role_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.kind is distinct from old.kind then
  if new.kind not in ('customer','both') and exists(
   select 1 from public.admin_financial_documents
   where counterparty_id=old.id and kind='sales_invoice'
  ) then
   raise exception 'Counterparty is linked to sales invoices and must retain customer role';
  end if;
  if new.kind not in ('supplier','both') and exists(
   select 1 from public.admin_financial_documents
   where counterparty_id=old.id and kind='purchase_invoice'
  ) then
   raise exception 'Counterparty is linked to purchase invoices and must retain supplier role';
  end if;
 end if;
 new.updated_at=now();
 return new;
end;
$$;
drop trigger if exists upt_admin_counterparty_role_change_guard on public.admin_counterparties;
create trigger upt_admin_counterparty_role_change_guard
 before update on public.admin_counterparties
 for each row execute function public.upt_admin_guard_counterparty_role_change();
revoke execute on function public.upt_admin_guard_counterparty_role_change() from public,anon,authenticated;
