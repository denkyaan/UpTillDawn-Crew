# Production platform upgrade

The inspected production database is at migration `20261007034820` and has 67
public application tables. Its Administration and Promotion platform tables are
absent. Main has the corresponding features and a newer task schema.

`supabase/upgrades/production-platform-plan.json` accounts for all 107 later
source migration files. The upgrade includes 97 and excludes ten historical
training, training-index, recovery-only and QA-cleanup migrations. Every source
has a SHA-256 digest; changed or unaccounted sources stop the builder. The
existing historical files are preserved.

The generated upgrade is one atomic SQL block. It checks the exact old column
contract, refuses partial platform installations, uses a short lock timeout and
serializes concurrent attempts. A complete installation is skipped. It adds the
platform tables and policies, private buckets and the administrative deadline
job. It aligns eighteen existing core functions with the implementation already
verified on main, without copying account records or runtime secrets. The final migration also
repairs the financial attachment path constraint, whose over-escaped dot
rejected the normal UUID filenames produced by uploads.

Generate the reviewed SQL without connecting to any database:

```sh
node scripts/build-production-upgrade.mjs /tmp/upt-production-upgrade.sql
```

The existing full CI now reconstructs the pre-platform source baseline, seeds
representative existing accounts, an event, completed work and stock, and
fingerprints every legacy public table. It applies the upgrade, checks that all
existing row values are preserved, verifies legacy staff rights, removes only
its own synthetic fixtures and applies the upgrade again to verify safe retry.
The crew lifecycle and authenticated browser tests then run on that upgraded
database. Fresh source replay and generated-type checks remain separate gates.

Production has not been modified by preparing this plan. Applying it requires a
verified successful upgrade run and the normal production release procedure.
The source migration ledger and this aggregate upgrade record are different
histories; do not replay the excluded legacy scripts to manufacture timestamp
parity. Take and verify a database backup before the production change.

## Other acceptance dependencies

Ticket CSV import and financial workflows have authenticated browser evidence.
The Eventix/Weeztix panel currently offers CSV import; a live provider adapter and
provider authorization are still required for automatic ticket synchronization.
SumUp reconciliation helpers exist, while a live transaction ingestion flow still
needs implementation and merchant access. Contract rendering and signing have
separate endpoint, certificate and dispatch gates; their hosted configuration
and an actual signing journey must be verified before declaring those services
operational. Passing core CI does not certify external accounts or providers.
