-- Retire the client-callable pre-auth admin lockout RPC surface.
-- Supabase Auth remains the credential authority and applies its own rate limits.
-- Keeping these SECURITY DEFINER mutations executable by anon allowed arbitrary
-- callers to increment another login identifier's lockout counter.

REVOKE EXECUTE ON FUNCTION public.upt_admin_login_guard(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upt_admin_login_failure(text,text,text,text) FROM anon, authenticated;

-- Preserve backend/service access for incident investigation or controlled
-- server-side use without exposing either function through browser roles.
GRANT EXECUTE ON FUNCTION public.upt_admin_login_guard(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upt_admin_login_failure(text,text,text,text) TO service_role;
