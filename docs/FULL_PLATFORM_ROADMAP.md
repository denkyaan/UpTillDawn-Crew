# Up Till Dawn — Full Platform Implementation Roadmap

Status: execution roadmap for the complete product upgrade.

## Product surfaces

1. Crew App — phone-first active-shift experience.
2. Operations — phone/tablet live event control for Responsible users.
3. Control Center — desktop-first planning, administration, analytics and configuration.

## Phase 1 — Reliability and platform foundations

- Complete NL/FR/EN/DE key-based i18n migration and CI coverage.
- Remove visible System Health page while retaining internal observability.
- Harden offline/PWA synchronization, idempotency, conflict handling and update lifecycle.
- Centralize permissions, notifications, realtime subscriptions and feature flags.
- Add performance budgets, error boundaries, rate limiting and database constraints.
- Expand E2E coverage for desktop, mobile, PWA, offline, realtime and RLS/security.
- Preserve the current validated production behavior as compatibility baseline.

## Phase 2 — Daily UX

- Phone-first Shift Home with timer, workplace, Responsible, next action, tasks, briefing and help.
- Desktop Control Center with event/workplace/staff/action panels.
- Global search and command palette.
- Planning calendar, filters, bulk actions, saved views and split-view details.
- Notification Center with categories, priority, read state, preferences and deep links.
- Draft/autosave, undo, skeletons, accessible focus/touch states and consistent terminology.

## Phase 3 — Live operations

- Occupancy and minimum staffing per workplace.
- No-show, late check-in, missing checkout, overrun and long-break detection.
- Temporary staff moves without destroying original planning.
- Live event timeline, approvals, incidents, help requests and expired tasks.
- Shift handover and control-room display mode.
- QR attendance hardening and kiosk support.

## Phase 4 — Workflow automation

- Event lifecycle: Draft → Planning → Published → Build → Live → Breakdown → Closed → Archived.
- Configurable trigger/condition/action automation engine.
- Event templates and selective cloning.
- Checklists, recurring tasks and automatic task generation.
- Briefing versions, change detection and mandatory re-acknowledgement.

## Phase 5 — Reporting and intelligence

- Post-event report covering staffing, attendance, hours, breaks, planning delta, incidents and tasks.
- Operational overtime/pay-period policy support without inventing payroll/legal rules.
- Event-over-event analytics, occupancy, response times and task throughput.
- Historical capacity/planning suggestions that remain advisory.

## Phase 6 — Operational extensions

- Staff onboarding and self-service availability/shift requests.
- Skills, certifications and expiry tracking.
- Material/inventory with QR/barcodes and returns.
- Transport/carpool/driver planning.
- Document Center and offline emergency mode.
- Event maps/floorplans without permanent employee GPS tracking.

## Phase 7 — Platform configuration

- Configurable role/permission matrix independent of role labels.
- Safe admin configuration layer below God Mode.
- God Mode preview/diff/audit/recovery controls.
- Optional organization/multi-tenant architecture if Up Till Dawn becomes a SaaS product.

## Delivery gates

Every implementation batch must pass:

- dependency audit;
- lint;
- TypeScript;
- unit/regression tests;
- production build;
- Cloudflare Worker build;
- Wrangler deployment dry-run;
- relevant SQL/RLS tests for schema/security changes.

No batch may silently weaken role scoping, attendance authority, offline integrity, auditability, privacy or the current mobile/web default behavior.
