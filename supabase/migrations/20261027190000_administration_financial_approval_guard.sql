-- Enforce approval and document state transitions in the database, not only in the UI.
create or replace function public.upt_admin_guard_financial_transition()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if tg_op='INSERT' then
  if new.status <> 'draft' or new.approved_by is not null or new.approved_at is not null then
   raise exception 'Financial documents must start as drafts';
  end if;
  return new;
 end if;
 if new.kind is distinct from old.kind or new.created_by is distinct from old.created_by then
  raise exception 'Financial document identity cannot change';
 end if;
 if old.status <> 'draft' and
  (new.net_amount is distinct from old.net_amount or new.tax_amount is distinct from old.tax_amount
   or new.counterparty_id is distinct from old.counterparty_id or new.document_number is distinct from old.document_number
   or new.currency is distinct from old.currency or new.notes is distinct from old.notes) then
  raise exception 'Submitted financial document content is immutable';
 end if;
 if new.status is distinct from old.status then
  if not (
   (old.status='draft' and new.status='review') or
   (old.status='review' and new.status='approved') or
   (old.status='approved' and new.status in ('issued','paid','void')) or
   (old.status='issued' and new.status in ('paid','void'))
  ) then raise exception 'Invalid financial document status transition'; end if;
  if new.status <> 'review' and not public.upt_is_admin() then
   raise exception 'Admin approval is required';
  end if;
  if new.status='approved' then
   if new.approved_by is distinct from auth.uid() or new.approved_at is null then
    raise exception 'Approval must identify the acting Admin';
   end if;
  end if;
 end if;
 if old.approved_by is not null and
  (new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at) then
  raise exception 'Approval evidence is immutable';
 end if;
 if new.status in ('approved','issued','paid','void') and (new.approved_by is null or new.approved_at is null) then
  raise exception 'Approval evidence is required';
 end if;
 return new;
end;
$$;
drop trigger if exists upt_admin_financial_transition_guard on public.admin_financial_documents;
create trigger upt_admin_financial_transition_guard
before insert or update on public.admin_financial_documents
for each row execute function public.upt_admin_guard_financial_transition();
revoke execute on function public.upt_admin_guard_financial_transition() from public,anon,authenticated;
