-- Serialize line mutations before their AFTER trigger reads the invoice lines.
-- Locking only when the totals are written lets a waiting writer store a sum
-- calculated before another transaction committed. Submission/approval uses
-- the same invoice row lock, so a line cannot slip into a submitted document.
create or replace function public.upt_admin_lock_invoice_line_document()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
 target_id uuid;
 document_status text;
begin
 if tg_op='UPDATE' and new.document_id is distinct from old.document_id then
  raise exception 'Invoice line document cannot be reassigned';
 end if;
 if tg_op='DELETE' then target_id:=old.document_id;
 else target_id:=new.document_id;
 end if;
 select status into document_status from public.admin_financial_documents
 where id=target_id for no key update;
 if not found or document_status<>'draft' then
  raise exception 'Invoice lines can only change while the document is draft';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
create trigger upt_admin_invoice_line_draft_lock
before insert or update or delete on public.admin_financial_lines
for each row execute function public.upt_admin_lock_invoice_line_document();
revoke all on function public.upt_admin_lock_invoice_line_document() from public,anon,authenticated;

-- A reminder approval must refer to the exact draft displayed to the Admin.
-- The revision is assigned by the database, including for direct API writes.
alter table public.admin_payment_reminders
 add column revision integer not null default 1 check (revision>0);
create or replace function public.upt_admin_guard_reminder_revision()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 if tg_op='INSERT' then
  new.revision:=1;
 else
  if new.status is distinct from old.status and new.status in ('approved','cancelled')
    and not public.upt_is_admin() then
   raise exception 'Reminder finalization requires an Admin' using errcode='42501';
  end if;
  new.revision:=old.revision+1;
 end if;
 return new;
end;
$$;
create trigger upt_admin_payment_reminder_revision_guard
before insert or update on public.admin_payment_reminders
for each row execute function public.upt_admin_guard_reminder_revision();
revoke all on function public.upt_admin_guard_reminder_revision() from public,anon,authenticated;
