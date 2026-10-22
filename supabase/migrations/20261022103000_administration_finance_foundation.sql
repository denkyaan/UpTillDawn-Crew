-- Administration foundation: staging migration; no external accounting/Peppol transmissions.
create or replace function public.upt_can_manage_administration()
returns boolean language sql stable security definer set search_path = ''
as $$
 select public.upt_is_approved() and (
   public.upt_is_admin() or exists (
     select 1 from public.portal_role_assignments a
     where a.user_id = (select auth.uid())
       and a.portal = 'administration' and a.role = 'administrative_staff'
       and a.approved = true and a.revoked_at is null
   )
 );
$$;
revoke all on function public.upt_can_manage_administration() from public;
grant execute on function public.upt_can_manage_administration() to authenticated;

create table if not exists public.admin_counterparties (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) > 0),
 kind text not null check (kind in ('customer','supplier','both')),
 vat_number text, enterprise_number text, peppol_endpoint text,
 email text, address jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.admin_financial_documents (
 id uuid primary key default gen_random_uuid(),
 counterparty_id uuid references public.admin_counterparties(id),
 event_id uuid references public.events(id),
 kind text not null check (kind in ('sales_invoice','purchase_invoice','credit_note','expense','quote')),
 document_number text, issue_date date, due_date date,
 currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
 net_amount numeric(15,2) not null default 0,
 tax_amount numeric(15,2) not null default 0,
 gross_amount numeric(15,2) generated always as (net_amount + tax_amount) stored,
 status text not null default 'draft' check (status in ('draft','review','approved','issued','paid','void')),
 external_reference text, peppol_status text not null default 'not_connected'
   check (peppol_status in ('not_connected','queued','sent','delivered','failed','received')),
 peppol_message_id text, notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint admin_financial_approval_consistent check (
  (approved_by is null and approved_at is null) or
  (approved_by is not null and approved_at is not null)
 )
);
create table if not exists public.admin_financial_lines (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 description text not null, quantity numeric(14,3) not null default 1,
 unit_price numeric(15,4) not null default 0,
 vat_rate numeric(5,2) not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
 created_at timestamptz not null default now()
);
create table if not exists public.admin_financial_audit (
 id bigint generated always as identity primary key,
 document_id uuid not null references public.admin_financial_documents(id) on delete restrict,
 actor_id uuid references auth.users(id),
 operation text not null,
 old_record jsonb, new_record jsonb,
 created_at timestamptz not null default now()
);
create or replace function public.upt_admin_financial_audit_trigger()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 insert into public.admin_financial_audit(document_id,actor_id,operation,old_record,new_record)
 values (coalesce(new.id,old.id),auth.uid(),tg_op,to_jsonb(old),to_jsonb(new));
 return coalesce(new,old);
end;
$$;
drop trigger if exists upt_admin_financial_audit on public.admin_financial_documents;
create trigger upt_admin_financial_audit after insert or update or delete
on public.admin_financial_documents for each row execute function public.upt_admin_financial_audit_trigger();

alter table public.admin_counterparties enable row level security;
alter table public.admin_financial_documents enable row level security;
alter table public.admin_financial_lines enable row level security;
alter table public.admin_financial_audit enable row level security;
revoke all on public.admin_counterparties, public.admin_financial_documents, public.admin_financial_lines, public.admin_financial_audit from anon;
grant select,insert,update on public.admin_counterparties, public.admin_financial_documents, public.admin_financial_lines to authenticated;
grant select on public.admin_financial_audit to authenticated;
create policy admin_counterparties_read on public.admin_counterparties for select to authenticated using (public.upt_can_manage_administration());
create policy admin_counterparties_insert on public.admin_counterparties for insert to authenticated with check (public.upt_can_manage_administration());
create policy admin_counterparties_update on public.admin_counterparties for update to authenticated using (public.upt_can_manage_administration()) with check (public.upt_can_manage_administration());
create policy admin_financial_read on public.admin_financial_documents for select to authenticated using (public.upt_can_manage_administration());
create policy admin_financial_insert on public.admin_financial_documents for insert to authenticated with check (public.upt_can_manage_administration() and status = 'draft' and approved_by is null);
create policy admin_financial_update on public.admin_financial_documents for update to authenticated
 using (public.upt_can_manage_administration() and (status in ('draft','review') or public.upt_is_admin()))
 with check (public.upt_can_manage_administration() and (public.upt_is_admin() or (status in ('draft','review') and approved_by is null and approved_at is null and peppol_status = 'not_connected')));
create policy admin_financial_lines_read on public.admin_financial_lines for select to authenticated using (public.upt_can_manage_administration());
create policy admin_financial_lines_insert on public.admin_financial_lines for insert to authenticated
 with check (public.upt_can_manage_administration() and exists (select 1 from public.admin_financial_documents d where d.id = document_id and d.status = 'draft'));
create policy admin_financial_lines_update on public.admin_financial_lines for update to authenticated
 using (public.upt_can_manage_administration() and exists (select 1 from public.admin_financial_documents d where d.id = document_id and d.status = 'draft'))
 with check (public.upt_can_manage_administration() and exists (select 1 from public.admin_financial_documents d where d.id = document_id and d.status = 'draft'));
create policy admin_financial_audit_read on public.admin_financial_audit for select to authenticated using (public.upt_can_manage_administration());
-- Index every foreign key to support referential integrity checks and joins.
create index if not exists admin_financial_documents_counterparty_idx on public.admin_financial_documents(counterparty_id);
create index if not exists admin_financial_documents_event_idx on public.admin_financial_documents(event_id);
create index if not exists admin_financial_documents_created_by_idx on public.admin_financial_documents(created_by);
create index if not exists admin_financial_documents_approved_by_idx on public.admin_financial_documents(approved_by);
create index if not exists admin_financial_lines_document_idx on public.admin_financial_lines(document_id);
create index if not exists admin_financial_audit_document_idx on public.admin_financial_audit(document_id);
create index if not exists admin_financial_audit_actor_idx on public.admin_financial_audit(actor_id);
-- No delete grants, no provider credentials, no automatic posting or Peppol sending.
