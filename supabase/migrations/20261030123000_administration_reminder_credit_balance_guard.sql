-- Enforce credit-adjusted overdue balance for newly drafted and approved reminders.
-- Existing cancelled reminders remain cancellable; no outbound email is sent.
create or replace function public.upt_admin_guard_payment_reminder()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
 original_doc public.admin_financial_documents%rowtype;
 paid_total numeric(15,2);
 credited_total numeric(15,2);
begin
 if tg_op='UPDATE' then
  if old.status<>'draft' or new.document_id is distinct from old.document_id
    or new.reminder_number is distinct from old.reminder_number
    or new.created_by is distinct from old.created_by then
   raise exception 'Reminder identity and finalized reminders are immutable';
  end if;
  if new.status not in ('draft','approved','cancelled') then raise exception 'Invalid reminder transition'; end if;
 end if;
 select * into original_doc from public.admin_financial_documents where id=new.document_id for update;
 if not found or original_doc.kind<>'sales_invoice'
   or original_doc.status not in ('approved','issued') then
  raise exception 'Reminders require an active approved sales invoice';
 end if;
 if new.status<>'cancelled' then
  select coalesce(sum(amount),0) into paid_total
  from public.admin_financial_payments where document_id=new.document_id;
  select coalesce(sum(gross_amount),0) into credited_total
  from public.admin_financial_documents
  where original_invoice_id=new.document_id and kind='credit_note'
    and status in ('approved','issued','paid');
  if original_doc.gross_amount<=paid_total+credited_total
    or original_doc.due_date is null
    or original_doc.due_date>=(now() at time zone 'Europe/Brussels')::date then
   raise exception 'Reminder requires an overdue credit-adjusted outstanding balance';
  end if;
 end if;
 if new.status='approved' then
  if not public.upt_is_admin() or new.approved_by is distinct from auth.uid() or new.approved_at is null then
   raise exception 'Reminder approval requires an Admin';
  end if;
 elsif new.approved_by is not null or new.approved_at is not null then
  raise exception 'Only approved reminders may include approval evidence';
 end if;
 return new;
end;
$$;
revoke execute on function public.upt_admin_guard_payment_reminder() from public,anon,authenticated;
