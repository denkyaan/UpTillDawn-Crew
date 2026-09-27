# Recovery and release gate

## Database recovery proof

A release is not considered disaster-recovery verified until all repository migrations replay successfully from an empty isolated Supabase project and the SQL regression suites pass against that project. Production must never be used as the replay target.

Required proof:

1. Create an isolated Supabase project.
2. Link the CLI to that project.
3. Run `npx supabase db push` from a clean checkout.
4. Regenerate database types and compare them with `types/crew-database.ts`.
5. Run every file in `tests/sql/` inside rollback transactions.
6. Create representative event/shift/attendance data, take a backup, restore it to a second isolated project, and rerun the critical workflow checks.
7. Run `SOURCE_COMMIT=<sha> DR_DATABASE_URL=<restored-connection-string> bash scripts/verify-remote-dr-restore.sh` against the restored project. The verifier requires matching latest migration state and executes every SQL regression suite with `ON_ERROR_STOP=1`.
8. Verify Storage objects, Edge Functions, Auth settings, Realtime settings and external jobs separately; a database restore does not by itself prove those platform surfaces.
9. Record migration count, source commit, backup timestamp, restored project reference, Storage/config verification and restore result in the release record.

### Remote DR safety

Prefer Supabase **Restore to a New Project** for a physical-backup proof. The restored project is independent of production, but external database jobs/extensions may begin executing immediately after a binary restore. Before exercising the restored copy, disable or redirect outbound integrations such as webhook/pg_net/cron targets where applicable.

Creating the second remote project can incur Supabase charges. Repository automation and the verification script are ready, but project creation/restore must not be triggered until the project cost has been explicitly confirmed.


### Verified local fresh-install proof

GitHub Actions run `36336833839` for commit `1002b85ee1446294f62d2f84d1f7a685a54fdb01` passed the isolated fresh-install gate: 166 repository migrations replayed from zero, all 16 SQL regression suites passed, and normalized generated `public` TypeScript types matched `types/crew-database.ts` exactly.

## Auth security gate

Supabase Auth leaked-password protection must be enabled in the production Auth project settings. This is a platform setting and is intentionally not represented as SQL migration state. A release review must verify the setting remains enabled. Current verification source: Supabase Security Advisor `auth_leaked_password_protection`; remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## God Mode recovery

God Mode source edits remain proposal-based. Restore creates a new proposal from a selected historical tree rather than rewriting production history. Publishing remains blocked until CI succeeds and the proposal is not behind `main`.

## Critical workflow gate

Before a major production release validate: registration/approval, event availability, assignment, shift confirmation, briefing acknowledgement, QR start request, responsible/admin approval, break start/stop, workplace transition, QR stop request, approval, final work-time summary, push delivery, offline queue replay, and role revocation.
