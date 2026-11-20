-- Verify official reference images at the database trust boundary.
-- Browser-supplied MIME types and client-side checks are not authoritative.
create or replace function public.upt_admin_register_promotion_reference(
 p_task uuid,p_path text,p_sha256 text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_id uuid;
 v_mime text;
 v_size bigint;
begin
 if v_actor is null or not exists(
  select 1 from public.profiles p where p.id=v_actor
   and p.role='admin' and p.approved and not p.account_blocked
 ) then raise exception 'Admin required' using errcode='42501'; end if;
 if not exists(select 1 from public.tasks where id=p_task) then
  raise exception 'Task missing' using errcode='22023';
 end if;
 if p_path not like v_actor::text||'/promotion-reference/%'
  or p_path like '%..%' or p_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'Invalid reference' using errcode='22023';
 end if;
 select o.metadata->>'mimetype',nullif(o.metadata->>'size','')::bigint
 into v_mime,v_size
 from storage.objects o
 where o.bucket_id='work-media' and o.name=p_path and o.owner_id=v_actor::text;
 if not found then raise exception 'Reference file missing' using errcode='22023'; end if;
 if coalesce(v_mime,'') not in ('image/jpeg','image/png','image/webp')
  or coalesce(v_size,0) not between 1 and 10485760 then
  raise exception 'Invalid reference image metadata' using errcode='22023';
 end if;
 insert into public.promotion_reference_media(task_id,storage_path,sha256,created_by)
 values(p_task,p_path,p_sha256,v_actor) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.upt_admin_register_promotion_reference(uuid,text,text) from public,anon;
grant execute on function public.upt_admin_register_promotion_reference(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
