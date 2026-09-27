drop policy if exists geoapify_rate_limits_no_direct_access
on upt_private.geoapify_rate_limits;

create policy geoapify_rate_limits_no_direct_access
on upt_private.geoapify_rate_limits
as restrictive
for all
to public
using (false)
with check (false);
