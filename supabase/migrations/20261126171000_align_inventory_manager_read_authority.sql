-- Align historical inventory detail SELECT policies with the canonical
-- manager authorization (20260928014432) and existing inventory item reads.
-- Only approved Admins already authorized to issue/settle may bypass the
-- per-workplace feature gate; all other roles retain the exact prior rules.
-- No mutation grants, policies, RPCs or user data are changed.
DROP POLICY IF EXISTS inventory_issues_read ON public.inventory_issues;
CREATE POLICY inventory_issues_read
ON public.inventory_issues FOR SELECT TO authenticated
USING (
  public.upt_is_approved()
  AND (
    public.upt_is_admin((SELECT auth.uid()))
    OR (
      public.upt_feature_allowed('inventory',event_id,workplace_id)
      AND (
        user_id=(SELECT auth.uid())
        OR upt_private.inventory_can_manage(event_id,workplace_id)
      )
    )
  )
);

DROP POLICY IF EXISTS inventory_movements_read ON public.inventory_movements;
CREATE POLICY inventory_movements_read
ON public.inventory_movements FOR SELECT TO authenticated
USING (
  public.upt_is_approved()
  AND (
    public.upt_is_admin((SELECT auth.uid()))
    OR (
      public.upt_feature_allowed('inventory',event_id,workplace_id)
      AND (
        target_user_id=(SELECT auth.uid())
        OR upt_private.inventory_can_manage(event_id,workplace_id)
      )
    )
  )
);

DROP POLICY IF EXISTS inventory_settlement_requests_read ON public.inventory_settlement_requests;
CREATE POLICY inventory_settlement_requests_read
ON public.inventory_settlement_requests FOR SELECT TO authenticated
USING (
  public.upt_is_approved()
  AND (
    public.upt_is_admin((SELECT auth.uid()))
    OR (
      public.upt_feature_allowed('inventory',event_id,workplace_id)
      AND (
        user_id=(SELECT auth.uid())
        OR upt_private.inventory_can_manage(event_id,workplace_id)
      )
    )
  )
);
