# UpTillDawn Crew roadmap

## Production product

The repository contains the following core capabilities. This list is not proof of current production or staging acceptance; see docs/ADMINISTRATION_DELIVERY_STATUS_20261030.md for current completion limits:

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

Additional infrastructure gates:

1. Enable Supabase Auth leaked-password protection.
2. Prove disaster recovery with a real physical backup restored to a new isolated Supabase project.

Any future roadmap item should be added only when it represents a new requested product capability, not already-completed historical work.

## Administration and promotion acceptance

Track current implementation and verification in `docs/ADMINISTRATION_DELIVERY_STATUS_20261030.md`. External delivery, bank/signing/OCR integrations and promotion evidence automation must be proven before calling the complete platform finished.
