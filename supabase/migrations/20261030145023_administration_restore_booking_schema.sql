-- Recover staging databases that received finance updates without the booking migrations.
-- Fresh databases already receive these objects from the original migrations.
do $recover$
begin
 if to_regclass('public.admin_artist_bookings') is null then
  execute $restore$
-- 20261026135000_admin_artist_bookings.sql
-- DJ booking register foundation. No automated emails, signatures or payments.
create table public.admin_artist_bookings (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 artist_name text not null check (length(btrim(artist_name)) between 1 and 180),
 agency_contact_id uuid references public.admin_counterparties(id) on delete set null,
 status text not null default 'enquiry' check (status in ('enquiry','negotiating','confirmed','cancelled')),
 performance_at timestamptz,
 fee_amount numeric(15,2) check (fee_amount is null or fee_amount >= 0),
 currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
 rider_notes text,
 internal_notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index admin_artist_bookings_event_idx on public.admin_artist_bookings(event_id);
create index admin_artist_bookings_agency_idx on public.admin_artist_bookings(agency_contact_id);
create index admin_artist_bookings_created_by_idx on public.admin_artist_bookings(created_by);
create index admin_artist_bookings_status_idx on public.admin_artist_bookings(status);
alter table public.admin_artist_bookings enable row level security;
revoke all on public.admin_artist_bookings from anon;
grant select, insert, update on public.admin_artist_bookings to authenticated;
create policy admin_artist_bookings_read on public.admin_artist_bookings
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_artist_bookings_insert on public.admin_artist_bookings
 for insert to authenticated with check (
  public.upt_can_manage_administration()
  and created_by = (select auth.uid())
  and status = 'enquiry'
 );
create policy admin_artist_bookings_update on public.admin_artist_bookings
 for update to authenticated
 using (public.upt_can_manage_administration())
 with check (public.upt_can_manage_administration());
-- Never grant delete; retain cancelled bookings for accountability.


-- 20261026150000_admin_artist_booking_communications.sql
-- Immutable, independently auditable DJ booking communication records.
create table public.admin_artist_booking_communications (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete restrict,
 kind text not null check (kind in ('email_sent','reply_received','follow_up')),
 details text not null check (length(btrim(details)) between 3 and 1500),
 actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index admin_artist_booking_communications_booking_created_idx on public.admin_artist_booking_communications(booking_id,created_at desc);
alter table public.admin_artist_booking_communications enable row level security;
revoke all on public.admin_artist_booking_communications from anon;
grant select, insert on public.admin_artist_booking_communications to authenticated;
create policy admin_artist_booking_communications_read on public.admin_artist_booking_communications
 for select to authenticated using (public.upt_can_manage_administration());
create policy admin_artist_booking_communications_insert on public.admin_artist_booking_communications
 for insert to authenticated with check (
  public.upt_can_manage_administration()
  and actor_id=(select auth.uid())
  and exists (select 1 from public.admin_artist_bookings b where b.id=booking_id)
 );
-- No update or delete grants: communication history is append-only.


-- 20261026151000_admin_artist_booking_follow_up.sql
-- Optional manual follow-up date for DJ bookings.
alter table public.admin_artist_bookings
 add column follow_up_at timestamptz;
create index admin_artist_bookings_follow_up_idx
 on public.admin_artist_bookings(follow_up_at)
 where follow_up_at is not null and status not in ('confirmed','cancelled');


-- 20261026152000_admin_artist_communication_actor_index.sql
-- Cover the actor foreign key for administration communication audit queries.
create index admin_artist_booking_communications_actor_idx
 on public.admin_artist_booking_communications(actor_id);


-- 20261026160000_admin_artist_agreement_terms.sql
-- Editable internal contract conditions; no automatic execution or signatures.
alter table public.admin_artist_bookings
 add column if not exists agreement_payment_terms text,
 add column if not exists agreement_cancellation_terms text,
 add column if not exists agreement_liability_terms text,
 add column if not exists agreement_governing_law text;
alter table public.admin_artist_bookings
 add constraint admin_artist_agreement_payment_length check (char_length(coalesce(agreement_payment_terms,'')) <= 3000),
 add constraint admin_artist_agreement_cancellation_length check (char_length(coalesce(agreement_cancellation_terms,'')) <= 3000),
 add constraint admin_artist_agreement_liability_length check (char_length(coalesce(agreement_liability_terms,'')) <= 3000),
 add constraint admin_artist_agreement_law_length check (char_length(coalesce(agreement_governing_law,'')) <= 3000);


-- 20261026163000_artist_agreement_versions.sql
-- Immutable internal agreement snapshots, separate from legally binding signatures.
create table if not exists public.admin_artist_agreement_versions (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete cascade,
 version_number integer not null check (version_number > 0),
 snapshot jsonb not null,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique (booking_id,version_number),
 constraint agreement_snapshot_object check (jsonb_typeof(snapshot)='object')
);
create index if not exists admin_artist_agreement_versions_created_by_idx on public.admin_artist_agreement_versions(created_by);
create index if not exists admin_artist_agreement_versions_booking_idx on public.admin_artist_agreement_versions(booking_id,version_number desc);
alter table public.admin_artist_agreement_versions enable row level security;
create policy artist_agreement_versions_read on public.admin_artist_agreement_versions for select to authenticated using (public.upt_can_manage_administration());
create policy artist_agreement_versions_insert on public.admin_artist_agreement_versions for insert to authenticated with check (public.upt_can_manage_administration() and created_by=(select auth.uid()));
grant select,insert on public.admin_artist_agreement_versions to authenticated;


-- 20261026170000_artist_agreement_internal_approval.sql
alter table public.admin_artist_agreement_versions
 add column approved_by uuid references auth.users(id),
 add column approved_at timestamptz,
 add constraint artist_agreement_approval_pair check ((approved_by is null) = (approved_at is null)),
 add constraint artist_agreement_separation check (approved_by is null or approved_by <> created_by);
create index admin_artist_agreement_versions_approved_by_idx on public.admin_artist_agreement_versions(approved_by);
create or replace function public.upt_guard_artist_agreement_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id
 or new.booking_id is distinct from old.booking_id
 or new.version_number is distinct from old.version_number
 or new.snapshot is distinct from old.snapshot
 or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at
 or old.approved_at is not null
 or new.approved_by is distinct from (select auth.uid())
 or new.approved_at is null then
  raise exception 'Agreement snapshot cannot be modified';
 end if;
 return new;
end;
$$;
create trigger guard_artist_agreement_approval before update on public.admin_artist_agreement_versions
for each row execute function public.upt_guard_artist_agreement_approval();
create policy artist_agreement_versions_approve on public.admin_artist_agreement_versions
for update to authenticated
using (public.upt_can_manage_administration() and approved_at is null and created_by <> (select auth.uid()))
with check (public.upt_can_manage_administration() and approved_by = (select auth.uid()));
grant update (approved_by,approved_at) on public.admin_artist_agreement_versions to authenticated;


-- 20261026173000_artist_agreement_signature_requests.sql
-- External signing requests: auditable preparation, no automatic signing or dispatch.
create table public.admin_artist_agreement_signature_requests (
 id uuid primary key default gen_random_uuid(),
 agreement_version_id uuid not null references public.admin_artist_agreement_versions(id),
 recipient_email text not null check (length(recipient_email) between 5 and 320),
 status text not null default 'prepared' check (status in ('prepared','cancelled')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 cancelled_at timestamptz,
 constraint artist_signature_cancel_consistency check ((status='cancelled') = (cancelled_at is not null))
);
create index admin_artist_signature_requests_version_idx on public.admin_artist_agreement_signature_requests(agreement_version_id,created_at desc);
create index admin_artist_signature_requests_created_by_idx on public.admin_artist_agreement_signature_requests(created_by);
alter table public.admin_artist_agreement_signature_requests enable row level security;
create policy artist_signature_requests_select on public.admin_artist_agreement_signature_requests for select to authenticated using (public.upt_can_manage_administration());
create policy artist_signature_requests_insert on public.admin_artist_agreement_signature_requests for insert to authenticated with check (
 public.upt_can_manage_administration() and created_by=(select auth.uid())
 and exists (select 1 from public.admin_artist_agreement_versions v where v.id=agreement_version_id and v.approved_at is not null)
);
grant select,insert on public.admin_artist_agreement_signature_requests to authenticated;


-- 20261026180000_artist_signature_preparation_cancellation.sql
-- Cancellation is a controlled state transition, never a signature or delivery.
create or replace function public.upt_cancel_artist_signature_preparation(p_request_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
 v_changed integer;
begin
 if not public.upt_can_manage_administration() then
  raise exception 'Not authorized';
 end if;
 update public.admin_artist_agreement_signature_requests
 set status = 'cancelled', cancelled_at = now()
 where id = p_request_id and status = 'prepared';
 get diagnostics v_changed = row_count;
 return v_changed = 1;
end;
$$;
create policy artist_signature_requests_cancel on public.admin_artist_agreement_signature_requests
for update to authenticated
using (public.upt_can_manage_administration() and status = 'prepared')
with check (public.upt_can_manage_administration() and status = 'cancelled' and cancelled_at is not null);
grant update (status,cancelled_at) on public.admin_artist_agreement_signature_requests to authenticated;
grant execute on function public.upt_cancel_artist_signature_preparation(uuid) to authenticated;
create or replace function public.upt_guard_artist_signature_preparation_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.agreement_version_id is distinct from old.agreement_version_id
 or new.recipient_email is distinct from old.recipient_email or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at or old.status <> 'prepared'
 or new.status <> 'cancelled' or new.cancelled_at is null then
  raise exception 'Signing preparation is immutable except cancellation';
 end if;
 return new;
end;
$$;
create trigger guard_artist_signature_preparation_update
before update on public.admin_artist_agreement_signature_requests
for each row execute function public.upt_guard_artist_signature_preparation_update();


-- 20261026183000_artist_signature_preparation_dedup.sql
-- Avoid accidental duplicate requests for one immutable agreement version.
create unique index if not exists admin_artist_signature_one_prepared_per_version
on public.admin_artist_agreement_signature_requests (agreement_version_id)
where status = 'prepared';


-- 20261026190000_private_contract_archive_bucket.sql
-- Private archive for approved artist and staff contracts.
-- No direct browser access: uploads and downloads require a separate audited server endpoint.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
 'administration-contracts',
 'administration-contracts',
 false,
 15728640,
 array['application/pdf','application/json']::text[]
)
on conflict (id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- Do not create authenticated or anonymous storage.object policies for this bucket.
-- The storage service role bypasses RLS and must only be used by trusted server code.
-- Explicitly remove any permissive policies accidentally created for this bucket
-- during development before production release.


-- 20261026193000_contract_archive_approved_artist_read.sql
-- Contract archive remains private. Grant session-scoped read only for
-- internally approved artist agreement versions. No direct client upload,
-- update, delete or staff-document access is granted by this migration.
create policy administration_contract_archive_artist_read
on storage.objects for select to authenticated
using (
 bucket_id = 'administration-contracts'
 and public.upt_can_manage_administration()
 and (storage.foldername(name))[1] = 'artist'
 and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 and (storage.foldername(name))[3] ~ '^v[1-9][0-9]*$'
 and name ~ '^artist/[0-9a-fA-F-]{36}/v[1-9][0-9]*/(draft|signed)-[a-f0-9]{64}\\.pdf$'
 and exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id::text = (storage.foldername(name))[2]
    and ('v' || v.version_number::text) = (storage.foldername(name))[3]
    and v.approved_at is not null
 )
);


-- 20261026213000_administration_contract_signing_ledger.sql
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


-- 20261026214500_administration_signing_approved_artist_access.sql
-- Scoped access to the signing ledger. Only approved artist versions can be
-- read/updated. Staff records remain inaccessible pending staff approval flow.
-- No direct INSERT, DELETE or unrestricted UPDATE is granted.
create policy administration_signing_artist_select
on public.administration_contract_signing_requests for select to authenticated
using (
 public.upt_can_manage_administration()
 and document_type='artist'
 and exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id= document_id and v.version_number=document_version
    and v.approved_at is not null
 )
);
create policy administration_signing_artist_update
on public.administration_contract_signing_requests for update to authenticated
using (
 public.upt_can_manage_administration()
 and document_type='artist'
 and exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id=document_id and v.version_number=document_version
    and v.approved_at is not null
 )
)
with check (
 public.upt_can_manage_administration()
 and document_type='artist'
 and exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id=document_id and v.version_number=document_version
    and v.approved_at is not null
 )
);
grant select on public.administration_contract_signing_requests to authenticated;
grant update (envelope_id,status,updated_at,dispatched_at,completed_at,signed_pdf_path)
on public.administration_contract_signing_requests to authenticated;

-- A ledger record must match the immutable approved artist version.
-- Backend-only record creation is still required before this update path works.
comment on table public.administration_contract_signing_requests is
 'Approved artist versions readable and conditionally updateable by administration; inserts remain server-restricted.';


-- 20261026220000_contract_signing_immutable_state_guard.sql
-- Prevent direct updates that change contract identity, envelope ownership,
-- or illegally advance terminal signing states. This guard runs even when
-- a future policy grants additional UPDATE permissions.
create or replace function public.upt_guard_contract_signing_update()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id
 or new.document_type is distinct from old.document_type
 or new.document_id is distinct from old.document_id
 or new.document_version is distinct from old.document_version
 or new.document_sha256 is distinct from old.document_sha256
 or new.recipient_email is distinct from old.recipient_email
 or new.created_at is distinct from old.created_at then
  raise exception 'Signing contract identity is immutable';
 end if;
 if old.envelope_id is not null and new.envelope_id is distinct from old.envelope_id then
  raise exception 'Signing envelope identity is immutable';
 end if;
 if old.envelope_id is null and new.envelope_id is not null and old.status <> 'draft' then
  raise exception 'Envelope attachment requires draft state';
 end if;
 if new.status is distinct from old.status and not (
  (old.status='draft' and new.status in ('sent','completed','rejected','cancelled'))
  or (old.status='sent' and new.status in ('completed','rejected','cancelled'))
 ) then
  raise exception 'Invalid signing state transition';
 end if;
 if new.status <> 'draft' and new.envelope_id is null then
  raise exception 'Signing envelope required';
 end if;
 if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
  raise exception 'Completion timestamp is immutable';
 end if;
 if new.status='completed' and new.completed_at is null then
  raise exception 'Completed signing requires timestamp';
 end if;
 if new.signed_pdf_path is distinct from old.signed_pdf_path and (
  old.signed_pdf_path is not null or new.status <> 'completed'
  or new.signed_pdf_path !~ ('^' || new.document_type || '/' ||
   new.document_id::text || '/v' || new.document_version::text ||
   '/signed-[a-f0-9]{64}\\.pdf$')
 ) then
  raise exception 'Invalid signed archive path';
 end if;
 new.updated_at=now();
 return new;
end;
$$;
revoke all on function public.upt_guard_contract_signing_update() from public;
drop trigger if exists guard_contract_signing_update on public.administration_contract_signing_requests;
create trigger guard_contract_signing_update
before update on public.administration_contract_signing_requests
for each row execute function public.upt_guard_contract_signing_update();


-- 20261026221500_artist_signing_prepare_rpc.sql
-- Explicit, atomic preparation of an approved artist agreement for signing.
-- SECURITY INVOKER is intentional: RLS is checked for the source version.
-- The ledger has no general INSERT privilege; only this validated RPC can insert.
create or replace function public.upt_prepare_artist_contract_signing(
 p_version_id uuid,
 p_version integer,
 p_source_sha256 text,
 p_recipient_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_id uuid;
begin
 if (select auth.uid()) is null or not public.upt_can_manage_administration() then
  raise exception 'Administration authorization required';
 end if;
 if p_version_id is null or p_version < 1
 or p_source_sha256 !~ '^[a-f0-9]{64}$'
 or length(trim(p_recipient_email)) not between 5 and 320
 or p_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'Invalid signing request';
 end if;
 if not exists (
  select 1 from public.admin_artist_agreement_versions v
  where v.id=p_version_id and v.version_number=p_version
    and v.approved_at is not null
 ) then
  raise exception 'Approved agreement version required';
 end if;
 insert into public.administration_contract_signing_requests(
  document_type,document_id,document_version,document_sha256,recipient_email
 ) values (
  'artist',p_version_id,p_version,p_source_sha256,lower(trim(p_recipient_email))
 )
 on conflict (document_type,document_id,document_version) do nothing
 returning id into v_id;
 if v_id is null then
  select id into v_id from public.administration_contract_signing_requests
  where document_type='artist' and document_id=p_version_id
    and document_version=p_version and document_sha256=p_source_sha256
    and recipient_email=lower(trim(p_recipient_email));
 end if;
 if v_id is null then
  raise exception 'Signing preparation conflicts with existing version';
 end if;
 return v_id;
end;
$$;
revoke all on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) from public,anon;
grant execute on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) to authenticated;
comment on function public.upt_prepare_artist_contract_signing(uuid,integer,text,text) is
 'Create or retrieve one signing ledger record for a previously approved immutable artist agreement version.';


-- 20261026233000_signing_ledger_block_client_forgery.sql
-- SECURITY: Never allow a browser-authenticated session to forge a
-- Documenso envelope, signing completion or signed PDF archive path.
-- The previous RLS policy scoped rows but could not authenticate remote
-- signature evidence. Keep approved-version SELECT access for UI status.
drop policy if exists administration_signing_artist_update
 on public.administration_contract_signing_requests;

revoke update on table public.administration_contract_signing_requests
 from authenticated, anon;
revoke update (envelope_id,status,updated_at,dispatched_at,completed_at,signed_pdf_path)
 on table public.administration_contract_signing_requests
 from authenticated, anon;

comment on table public.administration_contract_signing_requests is
 'Approved artist signing status readable by administration. No direct client UPDATE; verified backend transitions required.';


-- 20261027064500_contract_trigger_execute_hardening.sql
-- Trigger functions are invoked by PostgreSQL triggers, not through
-- the public API. Remove default PUBLIC EXECUTE and inherited access.
revoke execute on function public.upt_guard_artist_agreement_approval()
 from public, anon, authenticated;
revoke execute on function public.upt_guard_artist_signature_preparation_update()
 from public, anon, authenticated;
revoke execute on function public.upt_guard_contract_signing_update()
 from public, anon, authenticated;


-- 20261027090000_server_signing_transition_cas.sql
-- Server-only compare-and-swap for remote-verified signing state.
-- The caller must verify Documenso evidence independently before invoking.
-- No browser role may execute this function or update the ledger directly.
create or replace function public.upt_server_transition_contract_signing(
 p_envelope_id text,
 p_expected_status text,
 p_next_status text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_changed integer;
begin
 if current_user <> 'service_role' then
  raise exception 'Server role required' using errcode = '42501';
 end if;
 if p_envelope_id is null or p_envelope_id !~ '^[A-Za-z0-9_-]{1,128}$' then
  raise exception 'Invalid signing envelope';
 end if;
 if not (
  (p_expected_status = 'draft' and p_next_status in ('sent','completed','rejected','cancelled'))
  or (p_expected_status = 'sent' and p_next_status in ('completed','rejected','cancelled'))
 ) then
  raise exception 'Invalid signing state transition';
 end if;
 update public.administration_contract_signing_requests
 set status = p_next_status,
     updated_at = now(),
     dispatched_at = case when p_next_status = 'sent' then now() else dispatched_at end,
     completed_at = case when p_next_status = 'completed' then now() else completed_at end
 where envelope_id = p_envelope_id
   and status = p_expected_status
   and signed_pdf_path is null;
 get diagnostics v_changed = row_count;
 return v_changed = 1;
end;
$$;

revoke all on function public.upt_server_transition_contract_signing(text,text,text)
 from public, anon, authenticated;
grant execute on function public.upt_server_transition_contract_signing(text,text,text)
 to service_role;
comment on function public.upt_server_transition_contract_signing(text,text,text)
 is 'Server-role-only CAS. Caller must independently verify remote signature evidence.';


-- 20261028080000_admin_artist_booking_note_audit.sql
-- Audit only metadata for internal artist-booking note edits; never duplicate note contents.
create table public.admin_artist_booking_note_audit (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.admin_artist_bookings(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 changed_at timestamptz not null default now(),
 previous_length integer not null,
 new_length integer not null
);
create index admin_artist_booking_note_audit_booking_time_idx
 on public.admin_artist_booking_note_audit(booking_id,changed_at desc);
alter table public.admin_artist_booking_note_audit enable row level security;
revoke all on public.admin_artist_booking_note_audit from anon,authenticated;
grant select on public.admin_artist_booking_note_audit to authenticated;
create policy admin_artist_booking_note_audit_read on public.admin_artist_booking_note_audit
 for select to authenticated using (public.upt_can_manage_administration());

create or replace function public.upt_audit_artist_booking_note_change()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public'
as $$
begin
 if old.internal_notes is distinct from new.internal_notes then
  insert into public.admin_artist_booking_note_audit
   (booking_id,actor_id,previous_length,new_length)
  values (new.id,auth.uid(),length(coalesce(old.internal_notes,'')),length(coalesce(new.internal_notes,'')));
 end if;
 return new;
end;
$$;
drop trigger if exists upt_artist_booking_note_audit on public.admin_artist_bookings;
create trigger upt_artist_booking_note_audit
 after update of internal_notes on public.admin_artist_bookings
 for each row execute function public.upt_audit_artist_booking_note_change();
notify pgrst,'reload schema';


-- 20261028120000_administration_foreign_key_indexes.sql
-- Cover public foreign keys reported by the full staging release SQL gate.
-- These indexes improve joins and parent-row delete/update checks.
create index if not exists admin_artist_booking_note_audit_actor_id_idx
 on public.admin_artist_booking_note_audit(actor_id);
create index if not exists admin_financial_payments_created_by_idx
 on public.admin_financial_payments(created_by);
create index if not exists admin_payment_reminders_approved_by_idx
 on public.admin_payment_reminders(approved_by);
create index if not exists admin_payment_reminders_created_by_idx
 on public.admin_payment_reminders(created_by);


-- 20261028130000_restrict_artist_booking_audit_trigger_execution.sql
-- Trigger functions must never be directly executable by API roles.
-- The database trigger remains functional when these grants are revoked.
revoke all on function public.upt_audit_artist_booking_note_change() from public;
revoke all on function public.upt_audit_artist_booking_note_change() from anon;
revoke all on function public.upt_audit_artist_booking_note_change() from authenticated;

$restore$;
 end if;
end $recover$;

-- Administrative staff may draft; final approval belongs to an Admin.
alter policy artist_agreement_versions_approve on public.admin_artist_agreement_versions
 using (public.upt_can_manage_administration() and public.upt_is_admin() and approved_at is null and created_by<>(select auth.uid()))
 with check (public.upt_can_manage_administration() and public.upt_is_admin() and approved_by=(select auth.uid()));
create or replace function public.upt_guard_artist_agreement_initial_approval()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.approved_by is not null or new.approved_at is not null then
  raise exception 'Agreements must be created as unapproved drafts';
 end if;
 return new;
end $$;
create trigger upt_artist_agreement_initial_approval before insert on public.admin_artist_agreement_versions
 for each row execute function public.upt_guard_artist_agreement_initial_approval();
revoke all on function public.upt_guard_artist_agreement_initial_approval() from public,anon,authenticated;
create or replace function public.upt_guard_artist_booking_authority()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
  raise exception 'Booking identity is immutable';
 end if;
 if new.status is distinct from old.status and (new.status in ('confirmed','cancelled') or old.status in ('confirmed','cancelled'))
  and not public.upt_is_admin() then raise exception 'Admin required for final booking decisions' using errcode='42501'; end if;
 return new;
end $$;
create trigger upt_artist_booking_authority before update on public.admin_artist_bookings
 for each row execute function public.upt_guard_artist_booking_authority();
revoke all on function public.upt_guard_artist_booking_authority() from public,anon,authenticated;

notify pgrst,'reload schema';
