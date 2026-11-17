# Main-only Supabase Free runtime load mitigation (2026-11-17)

Target: isolated **Main test** Supabase project `npbjrtiolqperdgljnhi`.
**Not a production migration.** Do not apply this schedule to production without a separate operational review.

## Evidence

During the 2026-11-17 seven-role browser acceptance (08:34–08:48 UTC), the Main database reported 22 PostgreSQL statement timeouts, plus Supabase Auth 500/504 responses and pg_cron startup timeouts. Cloudflare had **no post-deploy exceededResources outcome** for the same run. The browser acceptance failed 5 of 111 checks while the functional workflow passed 20/20.

## Applied Main-only scheduling

All eight existing jobs remain active with their original SQL bodies. Only cadence/offset changed:

| Job | Previous | New |
|---|---|---|
| operational-alerts | every minute | `*/2 * * * *` |
| administration-deadlines | every minute | `1-59/2 * * * *` |
| driver-reminders | every minute | unchanged |
| responsible-ops | `*/5 * * * *` | `1-59/5 * * * *` |
| staff-ops | `*/5 * * * *` | `2-59/5 * * * *` |
| error-report-escalation | `*/5 * * * *` | `3-59/5 * * * *` |
| stale-notification-cleanup | `*/15 * * * *` | `4-59/15 * * * *` |
| birthday-greetings | `5 * * * *` | `7 * * * *` |

This reduces minute-boundary spikes and trades up to one extra minute of alert/deadline latency for fewer simultaneous database jobs on the Free plan. Driver reminders remain every minute.

The job names and bodies were verified against the active isolated Main database before modifications. The resulting eight active schedules were confirmed after changing them. No job was removed, no user data was changed, and production was untouched.

## Validation still required

The scheduling change is a load-mitigation measure, not proof of resolution. Re-run a Main-only seven-role authenticated browser E2E with no production release, and inspect the matching Supabase Auth, PostgREST, PostgreSQL, pg_cron and Cloudflare runtime logs. A green fast CI or successful Main Worker deploy alone is insufficient.

If future measurements indicate regressions or missed reminders, revert only the cadence in the Main test project using `cron.alter_job`, restoring the previous entries in the table above. Keep the original job names and SQL bodies.
