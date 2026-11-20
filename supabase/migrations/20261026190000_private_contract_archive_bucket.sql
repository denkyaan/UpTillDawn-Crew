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
