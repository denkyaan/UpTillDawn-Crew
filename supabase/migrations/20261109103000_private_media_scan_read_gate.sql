-- Do not expose unscanned chat, incident or operational media through
-- authenticated Storage GET/download or signed-URL creation.
-- Existing permissive role/ownership policies still determine WHO may read.
-- This restrictive gate additionally determines WHEN those reads are safe.
create or replace function upt_private.scanned_media_clean(p_bucket text,p_path text)
returns boolean
language sql stable security definer set search_path='pg_catalog'
as $$
 select p_bucket in ('chat-attachments','incident-photos','work-media')
  and exists(
   select 1 from public.upload_security_scans s
   where s.bucket_id=p_bucket and s.storage_path=p_path and s.status='clean'
  );
$$;
revoke all on function upt_private.scanned_media_clean(text,text) from public,anon,authenticated;
grant execute on function upt_private.scanned_media_clean(text,text) to authenticated;
comment on function upt_private.scanned_media_clean(text,text) is
 'Read-only verdict predicate for restrictive private Storage object reads; never accepts a client clean assertion.';

-- Existing files must not become implicitly trusted. Pre-existing verified
-- verdicts remain intact. Missing verdicts are enrolled as pending.
insert into public.upload_security_scans(
 bucket_id,storage_path,uploaded_by,mime_type,file_size_bytes,risk_class,status
)
select o.bucket_id,o.name,
 case when split_part(o.name,'/',1) ~*
  '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then split_part(o.name,'/',1)::uuid else null end,
 coalesce(o.metadata->>'mimetype','application/octet-stream'),
 case when coalesce(o.metadata->>'size','') ~ '^[0-9]{1,15}$'
  then (o.metadata->>'size')::bigint else null end,
 case when coalesce(o.metadata->>'mimetype','') like 'image/%'
    or coalesce(o.metadata->>'mimetype','') like 'video/%'
  then 'fast_media' else 'document' end,
 'pending'
from storage.objects o
where o.bucket_id in ('chat-attachments','incident-photos','work-media')
on conflict(bucket_id,storage_path) do nothing;

-- A PERMISSIVE read policy alone cannot bypass this restriction.
-- Do not impose scanning on profile photos, QR selfies or contract archives:
-- these buckets have distinct access and retention rules.
drop policy if exists upt_private_scanned_media_read_gate on storage.objects;
create policy upt_private_scanned_media_read_gate
on storage.objects as restrictive for select to authenticated using (
 bucket_id not in ('chat-attachments','incident-photos','work-media')
 or (select upt_private.scanned_media_clean(bucket_id,name))
);
comment on policy upt_private_scanned_media_read_gate on storage.objects is
 'Chat, incident and work-media originals require a clean project-isolated antivirus verdict before any app-role SELECT. Access scope is still enforced by existing permissive role policies.';
