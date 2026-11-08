-- An unchanged save must preserve the instruction version and existing evidence.
create or replace function upt_private.admin_update_promotion_task(p_task uuid,p_title text,p_description text,p_expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype;
begin
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or length(coalesce(p_description,''))>4000 then
  raise exception 'Invalid promotion task' using errcode='22023';
 end if;
 select * into v_task from public.tasks where id=p_task and promotion_only and event_id is null for update;
 if not found then raise exception 'General promotion task not found' using errcode='22023'; end if;
 if p_expected_updated_at is null or v_task.updated_at is distinct from p_expected_updated_at then
  raise exception 'Promotion task changed; reload before editing' using errcode='40001';
 end if;
 if v_task.title=btrim(p_title) and coalesce(v_task.description,'')=coalesce(p_description,'') then return p_task;end if;
 update public.tasks set title=btrim(p_title),description=coalesce(p_description,''),updated_at=clock_timestamp() where id=p_task;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'PROMOTION_TASK_UPDATED','task',p_task,jsonb_build_object('old_title',v_task.title,'new_title',btrim(p_title),
  'old_description',v_task.description,'new_description',coalesce(p_description,'')));
 return p_task;
end;
$$;
