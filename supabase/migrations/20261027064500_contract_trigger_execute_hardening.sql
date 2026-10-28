-- Trigger functions are invoked by PostgreSQL triggers, not through
-- the public API. Remove default PUBLIC EXECUTE and inherited access.
revoke execute on function public.upt_guard_artist_agreement_approval()
 from public, anon, authenticated;
revoke execute on function public.upt_guard_artist_signature_preparation_update()
 from public, anon, authenticated;
revoke execute on function public.upt_guard_contract_signing_update()
 from public, anon, authenticated;
