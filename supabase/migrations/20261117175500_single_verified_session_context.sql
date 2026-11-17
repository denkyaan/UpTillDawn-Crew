-- Consolidate the current signed-in user's profile, owner bit and role into
-- ONE PostgREST request. This is deliberately SECURITY INVOKER: it can only
-- call existing narrow, independently-authorized functions. The email comes
-- from the JWT verified by Supabase/PostgREST, never from browser metadata.
-- On Main this avoids a second local JWT verification plus 2-3 separate
-- network RPC calls during each CPU-constrained Next.js SSR navigation.
create or replace function public.upt_current_session_context()
returns table (
 id uuid,
 full_name text,
 phone_number text,
 profile_photo_url text,
 approved boolean,
 role text,
 account_blocked boolean,
 verified_email text,
 is_owner boolean,
 effective_role text
)
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public'
as $$
 select p.id, p.full_name, p.phone_number, p.profile_photo_url,
        p.approved, p.role, p.account_blocked,
        nullif(auth.jwt()->>'email', '')::text as verified_email,
        public.upt_current_is_owner() as is_owner,
        public.upt_current_effective_role() as effective_role
 from public.upt_current_profile() p
 where p.id=auth.uid()
$$;

revoke execute on function public.upt_current_session_context() from public, anon;
grant execute on function public.upt_current_session_context() to authenticated;
