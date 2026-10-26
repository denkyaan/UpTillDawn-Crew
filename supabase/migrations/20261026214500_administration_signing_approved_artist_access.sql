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
