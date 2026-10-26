-- Private ledger for signature requests. No browser-facing grants or policies.
-- Writes must be performed by a separately authorized backend transaction.
create table if not exists public.administration_contract_signing_requests (
 id uuid primary key default gen_random_uuid(),
 document_type text not null check (document_type in ('artist','staff')),
 document_id uuid not null,
 document_version integer not null check (document_version > 0),
 document_sha256 text not null check (document_sha256 ~ '^[a-f0-9]{64}$'),
 envelope_id text unique check (envelope_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 status text not null default 'draft' check (status in ('draft','sent','completed','rejected','cancelled')),
 recipient_email text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 dispatched_at timestamptz,
 completed_at timestamptz,
 signed_pdf_path text,
 constraint administration_contract_signing_requests_version_unique unique(document_type,document_id,document_version)
);
create index if not exists administration_contract_signing_requests_status_idx
 on public.administration_contract_signing_requests(status,updated_at);
alter table public.administration_contract_signing_requests enable row level security;
revoke all on public.administration_contract_signing_requests from anon,authenticated;
comment on table public.administration_contract_signing_requests is
 'Fail-closed signing ledger; application must implement narrowly scoped backend mutations before enabling dispatch.';
