-- Review-only image-reference signals. Never infer publication or misconduct.
-- Preserve duplicate guard details and expose a consistent manual-review state.
create or replace function public.upt_promotion_reference_precheck()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_task uuid;
  v_reference record;
  v_count integer;
begin
  select a.task_id into v_task
  from public.task_assignments a where a.id = new.assignment_id;
  if v_task is null then return new; end if;

  select count(*) into v_count
  from public.promotion_reference_media r where r.task_id = v_task;

  if v_count = 0 then
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','no_reference',
                            'publication_verified',false,
                            'requires_independent_verification',true);
    return new;
  end if;

  select r.id, r.sha256 into v_reference
  from public.promotion_reference_media r
  where r.task_id = v_task and r.sha256 = new.evidence_sha256
  order by r.created_at desc limit 1;

  if found then
    new.reference_sha256 = v_reference.sha256;
    new.reference_source = v_reference.id::text;
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','exact_file_match',
                            'publication_verified',false,
                            'requires_independent_verification',true);
  else
    new.verification_details = coalesce(new.verification_details, '{}'::jsonb)
      || jsonb_build_object('reference_check','no_exact_file_match',
                            'publication_verified',false,
                            'requires_independent_verification',true);
  end if;
  return new;
end;$$;

comment on function public.upt_promotion_reference_precheck() is
 'Review-only hash signal; never verifies publication or applies sanctions';
notify pgrst, 'reload schema';
