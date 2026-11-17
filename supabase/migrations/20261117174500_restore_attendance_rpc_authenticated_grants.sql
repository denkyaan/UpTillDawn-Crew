-- Restore intentionally exposed, self-service attendance RPC entry points.
-- Prior hardened grants inadvertently left these callable only by service_role.
-- Both implementations are SECURITY DEFINER and enforce auth.uid(), approved
-- membership, role, operational windows and (for check-in) assigned active shift.
-- This migration grants invocation, not table access or authorization bypass.
-- It must be deployed to Main first and verified before any future production CI.
revoke execute on function public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text) from public, anon;
revoke execute on function public.upt_request_check_out(uuid,text) from public, anon;
grant execute on function public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text) to authenticated;
grant execute on function public.upt_request_check_out(uuid,text) to authenticated;
