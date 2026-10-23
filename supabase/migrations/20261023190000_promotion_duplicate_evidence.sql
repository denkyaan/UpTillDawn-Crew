-- Duplicate image hashes are a review signal, not proof of fraud.
-- Flag matching files across submissions as inconclusive; never award strikes automatically.
create or replace function public.upt_promotion_evidence_duplicate_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(
  select 1 from public.promotion_evidence e
  where e.evidence_sha256=new.evidence_sha256 and e.id<>new.id
 ) then
  new.verification_status:='inconclusive';
  new.verification_details:=jsonb_build_object('reason','duplicate_file_hash','requires_independent_verification',true);
 end if;
 return new;
end;$$;
drop trigger if exists promotion_evidence_duplicate_guard on public.promotion_evidence;
create trigger promotion_evidence_duplicate_guard
 before insert on public.promotion_evidence
 for each row execute function public.upt_promotion_evidence_duplicate_guard();
revoke all on function public.upt_promotion_evidence_duplicate_guard() from public,anon,authenticated;
-- Do not allow users to complete promotion work by clicking a generic task-status button.
-- This restriction applies only to the promotion UI until dedicated promotion tasks are modeled.
