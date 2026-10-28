-- Preserve reference precheck metadata when duplicate evidence is flagged.
-- Duplicate hashes remain inconclusive and must never automatically trigger sanctions.
create or replace function public.upt_promotion_evidence_duplicate_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
  select 1 from public.promotion_evidence e
  where e.evidence_sha256=new.evidence_sha256 and e.id<>new.id
 ) then
  new.verification_status:='inconclusive';
  new.verification_details:=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reason','duplicate_file_hash','requires_independent_verification',true);
 end if;
 return new;
end;$$;
revoke all on function public.upt_promotion_evidence_duplicate_guard() from public,anon,authenticated;
comment on function public.upt_promotion_evidence_duplicate_guard() is
 'Preserves prior reference-check metadata; duplicates require independent verification, never automatic strikes';
