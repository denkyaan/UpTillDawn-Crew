-- Automated first-pass reference check. A hash match only means identical bytes,
-- never proof of a published social media post or grounds for a strike.
create or replace function public.upt_promotion_reference_precheck()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task uuid;v_reference record;v_count integer;
begin
 select a.task_id into v_task from public.task_assignments a
 where a.id=new.assignment_id;
 if v_task is null then return new;end if;
 select count(*) into v_count from public.promotion_reference_media r where r.task_id=v_task;
 if v_count=0 then
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','no_reference','publication_verified',false);
  return new;
 end if;
 select r.id,r.sha256 into v_reference from public.promotion_reference_media r
 where r.task_id=v_task and r.sha256=new.evidence_sha256 order by r.created_at desc limit 1;
 if found then
  new.reference_sha256=v_reference.sha256;
  new.reference_source=v_reference.id::text;
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','exact_file_match','publication_verified',false);
 else
  new.verification_details=coalesce(new.verification_details,'{}'::jsonb)||
   jsonb_build_object('reference_check','no_exact_file_match','publication_verified',false);
 end if;
 return new;
end;$$;
drop trigger if exists promotion_reference_precheck_insert on public.promotion_evidence;
create trigger promotion_reference_precheck_insert before insert on public.promotion_evidence
 for each row execute function public.upt_promotion_reference_precheck();
comment on function public.upt_promotion_reference_precheck() is
 'Non-punitive automated file hash precheck; no post verification, approval or strikes';
notify pgrst,'reload schema';
