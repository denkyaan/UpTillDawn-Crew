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
7. Record migration count, source commit, backup timestamp and restore result in the release record.

## Auth security gate

Supabase Auth leaked-password protection must be enabled in the production Auth project settings. This is a platform setting and is intentionally not represented as SQL migration state. A release review must verify the setting remains enabled.

## God Mode recovery

God Mode source edits remain proposal-based. Restore creates a new proposal from a selected historical tree rather than rewriting production history. Publishing remains blocked until CI succeeds and the proposal is not behind `main`.

## Critical workflow gate

Before a major production release validate: registration/approval, event availability, assignment, shift confirmation, briefing acknowledgement, QR start request, responsible/admin approval, break start/stop, workplace transition, QR stop request, approval, final work-time summary, push delivery, offline queue replay, and role revocation.
