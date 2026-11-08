-- Manual evidence approval completes the assignee's work in the same transaction.
-- Reconfirmation alone cannot make evidence from older instructions current.
create function upt_private.complete_verified_promotion_task()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_task public.tasks%rowtype; v_assignment public.task_assignments%rowtype; v_task_id uuid;
begin
 if new.verification_status<>'verified' or old.verification_status='verified' then return new;end if;
 if auth.uid() is null or not public.upt_is_admin() then
  raise exception 'Admin authorization required' using errcode='42501';
 end if;
 select task_id into v_task_id from public.task_assignments where id=new.assignment_id;
 select * into v_task from public.tasks where id=v_task_id for share;
 select * into v_assignment from public.task_assignments where id=new.assignment_id for update;
 if not found or v_assignment.user_id is distinct from new.submitted_by
  or v_assignment.status<>'IN PROGRESS' or v_assignment.confirmed_at is null
  or new.submitted_at<v_task.updated_at then
  raise exception 'Evidence no longer matches the confirmed task instructions' using errcode='22023';
 end if;
 update public.task_assignments set status='COMPLETED',updated_at=clock_timestamp() where id=v_assignment.id;
 insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'PROMOTION_TASK_COMPLETED','task_assignment',v_assignment.id,
  jsonb_build_object('task_id',v_task.id,'evidence_id',new.id));
 return new;
end;
$$;
revoke all on function upt_private.complete_verified_promotion_task() from public,anon,authenticated;
create trigger upt_promotion_evidence_complete_task after update of verification_status on public.promotion_evidence
 for each row execute function upt_private.complete_verified_promotion_task();
