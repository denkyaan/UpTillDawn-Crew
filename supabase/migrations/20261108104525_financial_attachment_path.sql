-- A literal dot in a Postgres regex needs no string-level backslash escaping.
-- The old double-escaped expression rejected the UUID.ext paths used by uploads.
alter table public.admin_financial_attachments drop constraint if exists admin_financial_attachment_path;
alter table public.admin_financial_attachments add constraint admin_financial_attachment_path
 check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](pdf|jpg|png|webp)$');
