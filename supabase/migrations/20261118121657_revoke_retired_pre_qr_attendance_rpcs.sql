-- Retire unauthenticated-GPS / pre-QR attendance entry points. Keep their definitions
-- for forensic compatibility, but signed-in clients must use upt_qr_request.
-- This does NOT touch the QR flow, check-in decisions, or live timeclock RPCs.
REVOKE ALL ON FUNCTION public.upt_request_check_in(uuid,uuid,boolean,text,numeric,numeric,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.upt_request_check_out(uuid,text) FROM PUBLIC,anon,authenticated;
