-- Keep task status mutations authorized against current event/workplace access.
CREATE OR REPLACE FUNCTION public.upt_update_task_status(p_assignment uuid, p_status text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_assignment public.task_assignments%rowtype;
  v_event uuid;
  v_workplace uuid;
begin
  if auth.uid() is null or not public.upt_is_approved() then raise exception 'Authentication required'; end if;
  if p_status not in ('NOT STARTED','IN PROGRESS','COMPLETED') then raise exception 'Invalid task status'; end if;

  select * into v_assignment
  from public.task_assignments
  where id=p_assignment
  for update;

  if not found then raise exception 'Task assignment not found'; end if;
  if v_assignment.user_id<>auth.uid() then raise exception 'Task assignment does not belong to this user'; end if;
  if v_assignment.confirmed_at is null then raise exception 'Bevestig de taak eerst.'; end if;

  select t.event_id,t.workplace_id into v_event,v_workplace
  from public.tasks t where t.id=v_assignment.task_id;
  if v_event is null then raise exception 'Task event not found'; end if;

  if not exists(
    select 1 from public.event_members em
    where em.event_id=v_event and em.user_id=auth.uid()
  ) then raise exception 'User is not a member of this event'; end if;

  if v_workplace is not null and not exists(
    select 1 from public.shifts s
    where s.event_id=v_event
      and s.workplace_id=v_workplace
      and s.user_id=auth.uid()
      and coalesce(s.status,'')<>'cancelled'
  ) then raise exception 'No valid shift for task workplace'; end if;

  if not public.upt_feature_allowed('tasks',v_event,v_workplace) then
    raise exception 'Taken zijn op dit moment niet beschikbaar.';
  end if;

  update public.task_assignments
  set status=p_status,updated_at=now()
  where id=p_assignment;

  insert into public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    auth.uid(),'TASK_STATUS_CHANGED','task_assignment',p_assignment,
    jsonb_build_object('old_status',v_assignment.status,'new_status',p_status,'task_id',v_assignment.task_id)
  );

  return p_assignment;
end
$function$;
