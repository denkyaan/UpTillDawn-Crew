# Recovery and release gate

## Local database rebuild proof

Every release CI must prove that the database can be rebuilt from an **empty isolated Supabase project** or equivalent isolated local Supabase stack:

1. start an isolated local Supabase stack;
2. replay all repository migrations from zero;
3. execute every SQL regression suite with `ON_ERROR_STOP=1`;
4. regenerate public TypeScript database types;
5. compare normalized generated types with `types/crew-database.ts`;
6. reset the isolated database and run the authenticated browser-bot fixtures.

At the verified pre-cleanup production release the repository contained **283 migrations** and **19 SQL regression suites**. Production-generated public database types matched the repository exactly.

Raw migration-count equality is not required for the existing production project because historical production-alignment migrations intentionally represented some equivalent repository history under different versions/names. Schema/type parity and release-contract checks remain authoritative.

## Remote disaster-recovery proof

A release is not disaster-recovery proven until a real production backup has been restored into a **new isolated Supabase project** and the restored copy has passed the recovery verifier.

Required proof:

1. Obtain a current production physical backup/restore point.
2. Use Supabase **Restore to a New Project**; never overwrite production for this test.
3. Before exercising the restored copy, disable or redirect outbound cron/webhook/`pg_net` integrations where appropriate.
4. Verify migration/schema state and generated types.
5. Run every SQL regression suite and the critical workflow checks.
6. Verify Storage objects, Edge Functions, Auth configuration, Realtime configuration and external jobs separately; a database restore alone does not prove those surfaces.
7. Run `SOURCE_COMMIT=<sha> DR_DATABASE_URL=<restored-connection-string> bash scripts/verify-remote-dr-restore.sh`.
8. Record source commit, backup timestamp, restored project reference and verification result.

There is currently no separate restore-test project in the connected Supabase account. Creating one may incur cost and therefore requires explicit cost confirmation before creation.

## Auth security gate

Supabase Auth leaked-password protection must be enabled in the hosted production Auth settings. The repository already enforces its own password-strength policy, but the Supabase Security Advisor still reports `auth_leaked_password_protection` as disabled.

## God Mode recovery

God Mode source edits remain proposal-based. Restore creates a new proposal from a selected historical tree rather than rewriting production history. Publishing remains blocked until CI succeeds and the proposal is not behind `main`.

## Critical workflow gate

For major releases validate registration/approval, event availability, assignment, shift confirmation, briefing acknowledgement, the QR start request and attendance flow, work/break/Driver transitions, timesheet approval/lock, push delivery, offline replay and role revocation.
