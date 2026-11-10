-- A designated Responsible must be able to prepare their *own* assigned
-- workplace before the event starts. upt_effective_role() intentionally
-- switches the operational Responsible mode on only near the event start,
-- so upt_is_responsible() is not a suitable pre-event READ gate.
--
-- This changes SELECT policies only. Operational writes remain protected by
-- their existing time-bound role checks. Unassigned workplaces and shifts
-- remain invisible; no Maker/Admin or staff rights are expanded.

-- Minimal private read-only helper: an explicit assignment is valid before
-- the operational role activates, but only for an approved *real* Responsible.
-- SECURITY DEFINER is necessary because ordinary staff cannot SELECT the
-- sensitive profiles table. No caller-supplied user identity is accepted.
CREATE OR REPLACE FUNCTION upt_private.can_read_own_responsible_assignment(
  p_event uuid,
  p_workplace uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, upt_private, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.responsible_assignments ra
      JOIN public.profiles p ON p.id = ra.user_id
      JOIN public.events e ON e.id = ra.event_id
      WHERE ra.user_id = auth.uid()
        AND ra.event_id = p_event
        AND ra.workplace_id = p_workplace
        AND p.approved = true
        AND p.role = 'responsible_lead'
        AND e.status <> 'archived'
        AND now() <= e.end_at
    );
$$;
REVOKE ALL ON FUNCTION upt_private.can_read_own_responsible_assignment(uuid,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upt_private.can_read_own_responsible_assignment(uuid,uuid)
  TO authenticated;

ALTER POLICY workplaces_read ON public.workplaces
USING (
  public.upt_is_admin()
  OR upt_private.is_event_responsible(event_id, (SELECT auth.uid()))
  OR public.upt_is_responsible(event_id, id, (SELECT auth.uid()))
  OR upt_private.can_read_own_responsible_assignment(workplaces.event_id, workplaces.id)
  OR EXISTS (
    SELECT 1
    FROM public.shifts s
    WHERE s.event_id = workplaces.event_id
      AND s.workplace_id = workplaces.id
      AND s.user_id = (SELECT auth.uid())
      AND s.status <> 'cancelled'
  )
);

-- This policy is RESTRICTIVE: changing only workplaces_read would still
-- conceal the same assigned workplace. Preserve existing staff-shift access.
ALTER POLICY upt_event_operational_window ON public.workplaces
USING (
  public.upt_is_approved()
  AND (
    public.upt_is_admin((SELECT auth.uid()))
    OR (
      (
        upt_private.is_event_responsible(event_id, (SELECT auth.uid()))
        OR public.upt_is_responsible(event_id, id, (SELECT auth.uid()))
      )
      AND upt_private.event_operational(event_id)
    )
    OR upt_private.can_read_own_responsible_assignment(workplaces.event_id, workplaces.id)
    OR EXISTS (
      SELECT 1
      FROM public.shifts s
      WHERE s.event_id = workplaces.event_id
        AND s.workplace_id = workplaces.id
        AND s.user_id = (SELECT auth.uid())
        AND s.status <> 'cancelled'
        AND coalesce(s.response_status, '') <> 'declined'
    )
  )
);

-- Allow the assigned Responsible to review their own workplace's team
-- schedule ahead of the effective operational role window. This does not
-- grant shift modification rights.
ALTER POLICY shifts_read ON public.shifts
USING (
  user_id = (SELECT auth.uid())
  OR public.upt_is_admin()
  OR upt_private.is_event_responsible(event_id, (SELECT auth.uid()))
  OR public.upt_is_responsible(event_id, workplace_id, (SELECT auth.uid()))
  OR upt_private.can_read_own_responsible_assignment(shifts.event_id, shifts.workplace_id)
);
