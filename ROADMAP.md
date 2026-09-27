# Uptilldawn roadmap

The current web/mobile/PWA experience is the production baseline.

## Completed baseline

- Auth / approval / role model and maker protection
- RLS and validated mutation boundaries
- Event, workplace, shift response/reassignment, replacement/swap/open-shift requests, revision-aware pre-shift reminders and Responsible management
- Check-in/out and work/break tracking
- Briefings, personal instructions, tasks, operational opening/closing/safety checklists with photo evidence, workplace material logistics with controlled Staff settlement approval, offline-cached event emergency information, scoped event/workplace documents with offline-critical caching, and help/incidents with current-workplace binding and escalation
- Workplace-scoped chat and private media
- Responsible and Staff workplace overview status
- Admin/Responsible operational dashboard, canonical live workplace tracking, understaffing, late/no-show, shift-overrun, missing-checkout and long-break alerts, Responsible shift handovers with inventory snapshots and time corrections
- IndexedDB queues and operational offline shell
- Contextual mobile navigation with expandable compact bar
- Installed PWA manifest/service worker behavior
- Web Push opt-in, delivery, badge/click handling and subscription renewal
- Cloudflare production deployment from `main`
- SQL security/regression suite aligned to the current permissions model\n- Admin System Health dashboard restored and backed by privacy-safe production health aggregates\n- Admin Release Readiness gate with repository/database migration matching and runtime blocker checks
- CI fresh-install database gate: isolated local Supabase replay from zero, all SQL regressions, and generated-type drift verification. Verified green on GitHub Actions run `36336833839` for commit `1002b85ee1446294f62d2f84d1f7a685a54fdb01` (166 migrations, 16 SQL suites, exact normalized public-type match).

## Remaining external / operational gates

1. **Temporarily deferred by the product owner:** enable Supabase leaked-password protection in the hosted Auth project settings. The repository password policy is already enforced, but this platform switch is still reported as disabled by the Supabase Security Advisor.
2. **Temporarily deferred by the product owner:** complete the remote backup -> restore disaster-recovery proof. A separate healthy Supabase project is available for testing, but only Supabase Restore to a New Project from a physical backup counts as the required DR proof.

## Completed hardening beyond the baseline

- Offline browsing now includes cached event emergency information, scoped critical event/workplace documents and operational snapshot support; the critical write workflows remain queue-backed and idempotent.
- Cross-device/PWA regression contracts for iOS/Android/Windows/browser install, service-worker refresh and offline behavior run in CI after material changes.
- Production observability includes Admin System Health, SLO/freshness alert helpers, operational alerts and Release Readiness; production Supabase logs were reviewed as part of the hardening pass.
- Worktime governance includes versioned Belgian operational overtime defaults, configurable daily/weekly thresholds and break exclusion. It is explicitly non-payroll-authoritative until an employer/pay-period payroll policy is formally supplied.

Changes to the current web/mobile layout should be treated as explicit product changes, not cleanup.
