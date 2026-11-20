-- Restore Data API table privilege for authenticated profile reads.
-- Row-level visibility remains enforced by the existing profiles RLS policies.
grant select on table public.profiles to authenticated;
