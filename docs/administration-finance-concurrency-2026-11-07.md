# Finance concurrency verification — 2026-11-07

## Changes

- Invoice line inserts, updates and deletes acquire the parent invoice's `FOR NO KEY UPDATE` lock before recalculating totals. Submission uses that same row, so a waiting line mutation rechecks draft status after the lock is acquired.
- Reminder edits, approvals and cancellations submit the displayed draft revision. The database increments revisions itself; stale forms affect zero rows and show a conflict message in all four languages.
- Reminder cancellation now requires Admin at the database boundary, including direct API updates by Administration staff.
- Payment forms carry a stable UUID used as the ledger primary key. Repeated submissions create one payment even without a bank reference. Exact replays succeed after a lost response or concurrent settlement; changed payloads and unrelated insert failures remain errors.
- Release migration baseline advances to `20261107184322`.

## Reproduced regression

Real PostgreSQL 17.11 transactions were synchronized at actual row-lock waits, using the repository's finance migrations and authenticated-role RLS. Minimal local fixtures supply Auth identities and portal roles.

| Simultaneous operations | Before migration | After migration |
| --- | --- | --- |
| Add lines of EUR 10 and EUR 20, both at 21% VAT | Header incorrectly stored EUR 20 net / EUR 4.20 VAT | EUR 30 net / EUR 6.30 VAT |
| Edit separate lines to EUR 15 and EUR 25, both at 21% VAT | Header incorrectly stored EUR 35 net / EUR 7.35 VAT | EUR 40 net / EUR 8.40 VAT |

The full database suite passes 12 scenarios: both races above, line-edit/submission ordering in both directions, competing payments, payments versus credit approvals in both directions, duplicate payment IDs, competing approvals, stale reminder approval, full settlement versus reminder approval, Administration/Admin privileges, and trigger function privileges/RLS.

Server-action tests also execute the actual finance actions with controlled database responses. They cover concurrent and sequential payment replays, changed replay payloads, missing IDs, balance changes during retries, unrelated insert failures, stale reminder edits/finalization, and invalid revisions.

Local validation passed: 1,072 unit/regression tests, 12 PostgreSQL integration scenarios, TypeScript checking, Next.js production build, and the production dependency audit (zero vulnerabilities). ESLint passed with zero errors and two existing warnings in unrelated files.

## Reproduction

Requires `psql` and a local PostgreSQL account that can create a disposable test database:

```bash
FINANCE_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres \
  node --test tests/sql/administration-finance-concurrency.integration.mjs
```

The suite creates and drops its own uniquely named database. `PSQL_BIN` can select an explicit client binary. To reproduce the two pre-fix failures, set `FINANCE_TEST_BASELINE=1` and add `--test-name-pattern='simultaneous line'` to the Node command. Fixtures are outside the staging SQL-suite directory.

## Release dependency and scope

Apply `20261107184322_administration_finance_concurrency.sql` before deploying the updated finance page, which reads and checks `admin_payment_reminders.revision`.

This verifies local database behavior, RLS and server actions. Hosted Supabase Auth, PostgREST/browser journeys and external payment/email providers were not exercised. No hosted migration, production merge or production deployment is part of this change.
