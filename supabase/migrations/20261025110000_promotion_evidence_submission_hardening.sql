-- Enforce evidence ownership, open assignments and image metadata in the database.
-- This is a new migration so already-deployed databases receive the correction.
create or replace function public.upt_submit_promotion_evidence(
 p_assignment uuid,p_storage_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_id uuid;
 v_status text;
 v_mime text;
 v_size bigint;
begin
 if v_actor is null then raise exception 'Login required' using errcode='42501'; end if;
 if public.upt_promotion_is_blocked(v_actor) then
  raise exception 'Promotion blocked' using errcode='42501';
 end if;
 select status::text into v_status from public.task_assignments
 where id=p_assignment and user_id=v_actor for update;
 if not found then raise exception 'Assignment not found' using errcode='42501'; end if;
 if upper(coalesce(v_status,'')) in ('COMPLETED','COMPLETE','DONE','CANCELLED','CANCELED') then
  raise exception 'Assignment closed' using errcode='42501';
 end if;
 if p_storage_path not like v_actor::text||'/promotion/%'
  or p_storage_path like '%..%'
  or p_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid evidence metadata' using errcode='22023';
 end if;
 select o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint
 into v_mime,v_size
 from storage.objects o
 where o.bucket_id='work-media' and o.name=p_storage_path
 and o.owner_id=v_actor::text;
 if not found then raise exception 'Evidence file missing' using errcode='22023'; end if;
 if coalesce(v_mime,'') not in ('image/jpeg','image/png','image/webp')
  or coalesce(v_size,0) not between 1 and 10485760 then
  raise exception 'Invalid evidence image metadata' using errcode='22023';
 end if;
 insert into public.promotion_evidence(assignment_id,submitted_by,storage_path,evidence_sha256)
 values(p_assignment,v_actor,p_storage_path,p_sha256) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_submit_promotion_evidence(uuid,text,text) from public,anon;
grant execute on function public.upt_submit_promotion_evidence(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
