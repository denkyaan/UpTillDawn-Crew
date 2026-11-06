-- Atomic, audited task metadata edits; assignments and status are deliberately untouched.
CREATE OR REPLACE FUNCTION public.upt_admin_update_event_task(p_task uuid,p_title text,p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_task public.tasks%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.upt_is_admin(auth.uid()) THEN
  RAISE EXCEPTION 'Admin authorization required';
 END IF;
 IF p_title IS NULL OR length(btrim(p_title))=0 OR length(p_title)>200 OR length(coalesce(p_description,''))>4000 THEN
  RAISE EXCEPTION 'Invalid task details';
 END IF;
 SELECT * INTO old_task FROM public.tasks WHERE id=p_task AND event_id IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event task not found'; END IF;
 UPDATE public.tasks SET title=btrim(p_title),description=coalesce(p_description,''),updated_at=now() WHERE id=p_task;
 INSERT INTO public.upt_audit_logs(actor_id,action,entity_type,entity_id,metadata)
 VALUES(auth.uid(),'EVENT_TASK_UPDATED','task',p_task,jsonb_build_object('old_title',old_task.title,'new_title',btrim(p_title),'old_description',old_task.description,'new_description',coalesce(p_description,'')));
 RETURN p_task;
END;
$$;
REVOKE ALL ON FUNCTION public.upt_admin_update_event_task(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upt_admin_update_event_task(uuid,text,text) TO authenticated;
