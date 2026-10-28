-- Trigger functions are invoked by PostgreSQL triggers, never directly by app roles.
revoke all on function public.upt_promotion_reference_precheck() from public,anon,authenticated;
