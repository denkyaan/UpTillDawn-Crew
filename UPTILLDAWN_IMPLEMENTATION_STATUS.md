# UpTillDawn Crew implementation status

## Production baseline

UpTillDawn Crew is deployed from `main` to Cloudflare Workers and uses the production Supabase project `eakoavcieossazqzplke`.

The last fully verified release before the first-use cleanup was:

- GitHub CI **#2811**: success;
- Cloudflare deploy workflow **#1034**: success;
- source commit: `e35ccff73570b7db0650c15341c4b3fc41f43dfc`;
- Node regression suite: **458/458 passed** during production deploy;
- public smoke: `/`, Admin login, Responsible login, Staff login, manifest and service worker all returned HTTP 200;
- production-generated public Supabase types matched `types/crew-database.ts` exactly.

The repository currently contains **283 ordered SQL migrations** and **19 SQL regression suites**. Historical migration names/versions can differ from production because earlier production alignment migrations intentionally folded equivalent historical changes together; schema/type parity is therefore the authoritative production parity check rather than raw migration-count equality.

## First-use readiness

The production operational state was verified before this cleanup:

- no real production events;
- no production workplaces, shifts, event memberships, work sessions, breaks, tasks, assignments, incidents, inventory rows, guestlist rows, sales rows or event messages;
- no obvious demo/test profile names;
- the organisation chat channel remains intentionally present;
- historical synced offline-operation records and operational notifications are retained as audit/runtime history rather than blindly deleted.

The standard workplace catalog is active and ready for first event creation:

1. Inkom & Guestlist
2. Merch
3. Bar/Toog
4. Tokens
5. Backstage Management
6. Driver
7. Allrounder
8. Opbouw
9. Afbouw

Event onboarding is enabled. New approved personnel are gated through required profile completion and the role tour. Training remains isolated from production data.

See `docs/FIRST_USE.md` for the canonical first real event sequence.

## Current product baseline

- Roles: Staff, Responsible Lead and Admin, with immutable maker/God Mode protections.
- Email verification + Admin approval before normal access.
- Event availability/deadline/capacity/waitlist workflow.
- Integrated workplaces + shifts, Responsible assignment and crew planning.
- Briefing acknowledgement and operational checklists.
- QR/check-in workflow, work/break timing, timesheets and audit-safe corrections.
- Driver workplace with event time vs driving time, mileage, transport tasks and Backstage artist-arrival notification.
- Inventory, guestlist/entrance, sales, tasks, incidents/help, chat and documents.
- PWA install/update/offline/push behavior.
- NL/FR/EN/DE UI contract and device-language synchronization.
- Safe training sandbox with role-specific guided tours.
- 15-browser-bot release gate plus SQL and Node regressions.
- Cloudflare deployment with production public-surface smoke checks.

## Supabase advisor state

Known findings are reviewed rather than blindly changed:

- tables intentionally exposed only through RPC/service boundaries can have RLS without browser policies;
- authenticated SECURITY DEFINER warnings include intentional application RPC boundaries covered by authorization regressions;
- `pg_net` placement is managed by the installed extension;
- **leaked-password protection is still disabled** and must be enabled in hosted Auth settings.

## Remaining external gates

1. Enable Supabase leaked-password protection.
2. Complete a real physical backup -> Restore to a New Project disaster-recovery proof. There is currently no separate restore-test project in the connected Supabase account, so project creation/cost must be confirmed before starting that proof.

The current web/mobile/PWA behavior is the canonical default. Cleanup must not remove historical migrations or audit evidence simply because they look old.
