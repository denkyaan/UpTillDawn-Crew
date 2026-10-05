# UpTillDawn Crew roadmap

## Production product

The core product is implemented and production-deployed. The current baseline includes:

- account verification, Admin approval, role gating and maker protection;
- event lifecycle, availability, capacity and waitlist;
- workplaces + shifts, Responsible assignment and crew planning;
- briefing, tasks, inventory, guestlist/entrance, sales, incidents/help, chat and documents;
- QR attendance, work/break timing, timesheets, overtime governance and audit-safe correction;
- Driver workflow with transport tasks, driving time, mileage and Backstage artist-arrival handling;
- PWA/offline/push/update behavior;
- NL/FR/EN/DE UI coverage and device-language synchronization;
- God Mode/Edit tooling and safe role-training sandbox;
- isolated database replay, SQL regressions, generated-type parity and 15 browser bots in CI;
- Cloudflare production deployment and public smoke validation.

## First real use

The production operational dataset is intentionally clean before the first real event. The Admin dashboard exposes a first-use sequence while no event exists. See `docs/FIRST_USE.md`.

## Remaining external infrastructure work

These are the only known intentionally deferred release-infrastructure gates:

1. Enable Supabase Auth leaked-password protection.
2. Prove disaster recovery with a real physical backup restored to a new isolated Supabase project.

Any future roadmap item should be added only when it represents a new requested product capability, not already-completed historical work.
