-- Apply only to isolated Main until an explicitly authorized production release.
-- Authenticated callers must not impersonate any other user in security-definer
-- task / driver permission RPCs. Signatures, SQL outputs and RLS call sites remain.
CREATE OR REPLACE FUNCTION public.upt_can_manage_task(p_task uuid,p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog','public','pg_temp'
AS $$
 SELECT p_uid = (SELECT auth.uid())
   AND (SELECT public.upt_is_approved())
   AND EXISTS(
     SELECT 1 FROM public.tasks t
     WHERE t.id=p_task AND (
       public.upt_is_admin(p_uid) OR
       (t.workplace_id IS NOT NULL AND public.upt_is_responsible(t.event_id,t.workplace_id,p_uid))
     )
   );
$$;

CREATE OR REPLACE FUNCTION public.upt_can_read_task(p_task uuid,p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog','public','pg_temp'
AS $$
 SELECT p_uid = (SELECT auth.uid())
   AND (SELECT public.upt_is_approved())
   AND EXISTS(
     SELECT 1 FROM public.profiles p
     WHERE p.id=p_uid AND p.approved=true AND NOT coalesce(p.account_blocked,false)
   )
   AND EXISTS(
     SELECT 1 FROM public.tasks t
     WHERE t.id=p_task AND (
       public.upt_is_admin(p_uid)
       OR (t.workplace_id IS NOT NULL AND public.upt_is_responsible(t.event_id,t.workplace_id,p_uid))
       OR EXISTS(SELECT 1 FROM public.task_assignments ta WHERE ta.task_id=t.id AND ta.user_id=p_uid)
     )
   );
$$;

CREATE OR REPLACE FUNCTION public.upt_is_driver_supervisor(p_event uuid,p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog','public','pg_temp'
AS $$
 SELECT p_uid = (SELECT auth.uid())
   AND (SELECT public.upt_is_approved())
   AND (
     public.upt_is_admin(p_uid)
     OR EXISTS(
       SELECT 1 FROM public.responsible_assignments ra
       JOIN public.workplaces w ON w.id=ra.workplace_id
       WHERE ra.event_id=p_event AND ra.user_id=p_uid
         AND lower(w.name) LIKE '%backstage%'
     )
   );
$$;

REVOKE ALL ON FUNCTION public.upt_can_manage_task(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.upt_can_read_task(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.upt_is_driver_supervisor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upt_can_manage_task(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upt_can_read_task(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upt_is_driver_supervisor(uuid,uuid) TO authenticated;
