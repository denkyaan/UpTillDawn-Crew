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
