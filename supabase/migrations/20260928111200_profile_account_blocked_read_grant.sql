-- Keep the profile privacy model column-scoped while allowing the authenticated
-- layout/auth guards to read the newly introduced block status.
--
-- The account_blocked column was added after the original column-level grants
-- in 20260922211452_uptilldawn_profile_privacy.sql. Without this grant,
-- PostgREST rejects otherwise valid self-profile reads with SQLSTATE 42501.

grant select(account_blocked) on table public.profiles to authenticated;

notify pgrst, 'reload schema';
