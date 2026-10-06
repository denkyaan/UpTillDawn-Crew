-- Retire the legacy standalone God Mode credential path.
-- God Mode is entered only from an authenticated permanent-maker session,
-- which obtains a short-lived owner-bound token through upt_god_login_owner().

revoke all on function public.upt_god_login(text,text) from public,anon,authenticated;
revoke all on function public.upt_god_set_credentials(text,text) from public,anon,authenticated;
revoke all on function public.upt_god_is_configured() from public,anon,authenticated;

grant execute on function public.upt_god_login(text,text) to service_role;
grant execute on function public.upt_god_set_credentials(text,text) to service_role;
grant execute on function public.upt_god_is_configured() to service_role;

notify pgrst,'reload schema';
