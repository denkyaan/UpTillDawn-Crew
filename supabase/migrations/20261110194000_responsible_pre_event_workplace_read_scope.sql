-- A designated Responsible must be able to prepare their *own* assigned
-- workplace before the event starts. upt_effective_role() intentionally
-- switches the operational Responsible mode on only near the event start,
-- so upt_is_responsible() is not a suitable pre-event READ gate.
--
-- This changes SELECT policies only. Operational writes remain protected by
-- their existing time-bound role checks. Unassigned workplaces and shifts
-- remain invisible; no Maker/Admin or staff rights are expanded.

ALTER POLICY workplaces_read ON public.workplaces
USING (
  public.upt_is_admin()
  OR upt_private.is_event_responsible(event_id, (SELECT auth.uid()))
  OR public.upt_is_responsible(event_id, id, (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.responsible_assignments ra
    JOIN public.profiles p ON p.id = ra.user_id
    WHERE ra.event_id = workplaces.event_id
      AND ra.workplace_id = workplaces.id
      AND ra.user_id = (SELECT auth.uid())
      AND p.approved = true
      AND p.role = 'responsible_lead'
      AND upt_private.event_operational(workplaces.event_id)
  )
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
    OR EXISTS (
      SELECT 1
      FROM public.responsible_assignments ra
      JOIN public.profiles p ON p.id = ra.user_id
      WHERE ra.event_id = workplaces.event_id
        AND ra.workplace_id = workplaces.id
        AND ra.user_id = (SELECT auth.uid())
        AND p.approved = true
        AND p.role = 'responsible_lead'
        AND upt_private.event_operational(workplaces.event_id)
    )
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
  OR EXISTS (
    SELECT 1
    FROM public.responsible_assignments ra
    JOIN public.profiles p ON p.id = ra.user_id
    WHERE ra.event_id = shifts.event_id
      AND ra.workplace_id = shifts.workplace_id
      AND ra.user_id = (SELECT auth.uid())
      AND p.approved = true
      AND p.role = 'responsible_lead'
      AND upt_private.event_operational(shifts.event_id)
  )
);
