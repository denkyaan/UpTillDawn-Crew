-- Capture an immutable official reference hash for each evidence submission.
-- A matching hash proves file identity only; it does NOT prove a social post was published.
alter table public.promotion_evidence
 add column if not exists reference_sha256 text
 check(reference_sha256 is null or reference_sha256 ~ '^[0-9a-f]{64}$');
alter table public.promotion_evidence
 add column if not exists reference_source text;
create index if not exists promotion_evidence_pending_idx
 on public.promotion_evidence(submitted_at)
 where verification_status='pending';
-- Evidence can only be marked verified after independent verification;
-- equality to official media alone cannot establish publication.
comment on column public.promotion_evidence.reference_sha256 is
 'SHA-256 of the official reference media; hash equality alone does not verify a published post';
comment on column public.promotion_evidence.reference_source is
 'Identifier of the official reference material used for comparison';
notify pgrst,'reload schema';
