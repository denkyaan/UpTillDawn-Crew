# Public database least-privilege hardening — main-test

## Verified finding (9 November 2026)

Read-only query of the **main-test** Supabase database found that 50 of 103
`public` ordinary/partitioned tables granted the `authenticated` database
role `TRUNCATE`; the same 50 also granted `TRIGGER`. The ordinary
`anon` database role did not have `TRUNCATE`.

PostgreSQL row-level security is for row-level SELECT/INSERT/UPDATE/DELETE,
not TRUNCATE. PostgREST does **not** ordinarily expose a raw TRUNCATE action,
so the presence of a grant alone is not evidence an anonymous web visitor
could truncate a table. The grants nevertheless expand the privilege
surface unnecessarily (e.g. if a database SQL connection or privileged
invoker flow were compromised).

## Migration

`20261109091500_public_table_unsafe_privilege_revoke.sql` iterates
ordinary and partitioned tables in `public`, revoking only
`TRUNCATE`, `TRIGGER` and `REFERENCES` from `PUBLIC`, `anon` and
`authenticated`. It does not revoke `SELECT`, `INSERT`,
`UPDATE`, or `DELETE`, modify RLS policies, truncate data, or alter the
service-role maintenance account.

The migration is idempotent, operates on all current public tables and
protects existing data. Future schema migrations must not grant those
privileges back; the SQL regression checks the **whole** public table
inventory after migration replay.

## Acceptance

- Node source-guard test:
  `tests/public-table-least-privilege.test.mjs`.
- SQL isolation test:
  `tests/sql/public_table_unsafe_privileges.sql`, requiring zero unsafe
  grants for `anon` and `authenticated` while preserving known
  authorized app `SELECT`/`INSERT` grants.
- Main-test check: run the read-only privilege count before and after applying
  the migration; expected `authenticated_can_truncate = 0` and
  `authenticated_can_create_triggers = 0`.
- Verify fast PR and main CI, main Worker build and smoke tests. Full
  authenticated browser workflow acceptance and production recovery remain
  separate gates.

Production credentials, schema and release workflows are not modified.
