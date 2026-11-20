drop policy if exists operational_alerts_no_direct_access on upt_private.operational_alerts;
create policy operational_alerts_no_direct_access
on upt_private.operational_alerts
as restrictive
for all
to public
using (false)
with check (false);
