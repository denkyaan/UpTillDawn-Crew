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
