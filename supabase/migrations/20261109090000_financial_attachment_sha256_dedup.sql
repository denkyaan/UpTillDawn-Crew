-- Cryptographic fingerprint for administrative financial document attachments.
-- Historic objects cannot be hashed correctly inside PostgreSQL because file
-- contents live in private Supabase Storage, not the relational database.
-- Their NULL SHA-256 values are intentionally preserved until reviewed and
-- verified against the original bytes. Never backfill from filenames.
alter table public.admin_financial_attachments
 add column if not exists sha256 text;

alter table public.admin_financial_attachments
 drop constraint if exists admin_financial_attachments_sha256_valid;
alter table public.admin_financial_attachments
 add constraint admin_financial_attachments_sha256_valid
 check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

-- One verified copy per invoice, regardless of uploaded name, case, or file
-- extension. The partial index preserves existing historic NULL values.
-- A concurrent duplicate metadata insertion is rejected atomically.
create unique index if not exists admin_financial_attachments_document_sha256_unique
 on public.admin_financial_attachments(document_id,sha256)
 where sha256 is not null;

-- Historic broad grants include UPDATE/DELETE/TRUNCATE for authenticated,
-- even though the intended attachment archive is append-only. RLS cannot
-- protect against TRUNCATE; remove those table privileges explicitly.
-- Keep SELECT and INSERT for the existing authorized upload and download
-- workflows. The service role retains maintenance/migration capability.
revoke update, delete, truncate, references, trigger
 on table public.admin_financial_attachments
 from authenticated, anon;

comment on column public.admin_financial_attachments.sha256
 is 'SHA-256 of uploaded private storage bytes, supplied by the server-side upload workflow. NULL identifies historic unverified attachments.';
