-- Invoice line mutations remain limited to draft documents at database level.
-- Removing a line triggers the existing authoritative total recalculation.
create policy admin_financial_lines_delete on public.admin_financial_lines
for delete to authenticated using (
 public.upt_can_manage_administration()
 and exists (
  select 1 from public.admin_financial_documents d
  where d.id=document_id and d.status='draft'
 )
);

-- Do not permit changing a line's owning document through the update policy.
create or replace function public.upt_admin_guard_invoice_line_owner()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if tg_op='UPDATE' and new.document_id is distinct from old.document_id then
  raise exception 'Invoice line document cannot be reassigned';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_invoice_line_owner_guard on public.admin_financial_lines;
create trigger upt_admin_invoice_line_owner_guard before update
on public.admin_financial_lines for each row execute function public.upt_admin_guard_invoice_line_owner();
revoke execute on function public.upt_admin_guard_invoice_line_owner() from public,anon,authenticated;
