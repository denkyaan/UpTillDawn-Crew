-- Reminder drafts are internal records only; no emails are sent by this migration.
create table if not exists public.admin_payment_reminders (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 reminder_number integer not null check (reminder_number between 1 and 9),
 subject text not null check (length(trim(subject)) between 1 and 200),
 body text not null check (length(trim(body)) between 1 and 10000),
 recipient_email text not null check (length(trim(recipient_email)) between 3 and 320),
 status text not null default 'draft' check (status in ('draft','approved','cancelled')),
 created_by uuid not null default auth.uid() references auth.users(id),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 constraint admin_payment_reminders_approval_check check (
  (status='approved' and approved_by is not null and approved_at is not null)
  or (status<>'approved' and approved_by is null and approved_at is null)
 )
);
create unique index if not exists admin_payment_reminders_unique_sequence
 on public.admin_payment_reminders(document_id,reminder_number);
create index if not exists admin_payment_reminders_document_idx on public.admin_payment_reminders(document_id);
alter table public.admin_payment_reminders enable row level security;
revoke all on public.admin_payment_reminders from anon;
grant select,insert,update on public.admin_payment_reminders to authenticated;
create policy admin_payment_reminders_read on public.admin_payment_reminders for select to authenticated
 using(public.upt_can_manage_administration());
create policy admin_payment_reminders_insert on public.admin_payment_reminders for insert to authenticated
 with check(public.upt_can_manage_administration() and created_by=auth.uid() and status='draft');
create policy admin_payment_reminders_update on public.admin_payment_reminders for update to authenticated
 using(public.upt_can_manage_administration() and status='draft')
 with check(public.upt_can_manage_administration() and status in ('draft','approved','cancelled'));

create or replace function public.upt_admin_guard_payment_reminder()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare original_doc public.admin_financial_documents%rowtype;
 paid_total numeric(15,2);
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
 if not found or original_doc.kind not in ('sales_invoice','purchase_invoice')
  or original_doc.status not in ('approved','issued') then
  raise exception 'Reminders require an active approved invoice';
 end if;
 select coalesce(sum(amount),0) into paid_total from public.admin_financial_payments where document_id=new.document_id;
 if original_doc.gross_amount<=paid_total or original_doc.due_date is null
  or original_doc.due_date>=current_date then
  raise exception 'Reminder requires an overdue outstanding balance';
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
create trigger upt_admin_payment_reminder_guard before insert or update on public.admin_payment_reminders
 for each row execute function public.upt_admin_guard_payment_reminder();
revoke execute on function public.upt_admin_guard_payment_reminder() from public,anon,authenticated;
