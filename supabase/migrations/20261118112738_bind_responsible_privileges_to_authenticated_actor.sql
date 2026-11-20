-- The caller can inspect Responsible permissions only for their own session.
-- Prevent SECURITY DEFINER delegation through the optional uid argument.
-- All existing RLS policies and legitimate business RPCs already pass auth.uid().
CREATE OR REPLACE FUNCTION public.upt_is_responsible(
  event_uuid uuid,
  workplace_uuid uuid DEFAULT NULL::uuid,
  uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $function$
  SELECT coalesce(
    uid = (SELECT auth.uid())
    AND (SELECT public.upt_is_approved())
    AND public.upt_effective_role(uid) = 'responsible_lead'
    AND EXISTS(
      SELECT 1 FROM public.responsible_assignments ra
      WHERE ra.user_id=uid
        AND ra.event_id=event_uuid
        AND (workplace_uuid IS NULL OR ra.workplace_id=workplace_uuid)
    ),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.upt_is_responsible(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upt_is_responsible(uuid,uuid,uuid) TO authenticated;
