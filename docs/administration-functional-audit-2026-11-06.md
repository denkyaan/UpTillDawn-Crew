# Administration functional audit — 2026-11-06

## Scope and evidence
Static source inspection of the Administration portal on branch `feature/administration-completion-bundle` (PR #162). This is **not** a browser E2E audit, database migration verification, or live integration certification. No production deployment is authorized by this audit.

## Verified in source
- Administration layout implements portal access checks: `app/(app)/portals/administration/layout.tsx`.
- Six-category navigation and route mapping: `components/administration/administration-navigation.tsx`, `lib/administration/navigation.ts`.
- Finance page has server actions for counterparty creation/editing, invoice drafts and lines, reminders, payments, and attachments: `app/(app)/portals/administration/finance/page.tsx`.
- Rosters page implements proposal/status actions: `app/(app)/portals/administration/rosters/page.tsx`.
- Promotion discipline page includes evidence reference and unblock flows: `app/(app)/portals/administration/promotion-discipline/page.tsx`.
- Notification list includes per-item and bulk read actions and guarded in-portal links: `app/(app)/portals/administration/modules/[slug]/page.tsx`.
- Counterparties page supports edit, name search, and kind filter: `app/(app)/portals/administration/counterparties/page.tsx`.
- Multiple Administration test files exist, but their existence does not demonstrate live user journeys.

## Confirmed gaps and risks
| Priority | Area | Evidence | Required acceptance test |
| --- | --- | --- | --- |
| P0 | Generic module content | `modules/[slug]/page.tsx` renders shared dashed cards with `u.notAvailable` and `u.pending` for module sections, even alongside live content | Every visible module card must either perform a real action or clearly explain the specific unavailable capability; no misleading generic placeholders |
| P0 | End-to-end coverage | Static tests are present; no authenticated, browser-driven complete workflow has been verified in this audit | Execute login → role switch → navigation → create/edit → submit/approve → report/export on staging, including error and denied-permission cases |
| P0 | Production readiness | PR #162 remains unmerged; staging/production database migrations and secrets have not been verified in this audit | Verify migrations, RLS, integrations, smoke tests and rollback before an explicitly approved production release |
| P1 | Promotion task management | `promotion-tasks/page.tsx` only lists up to 100 task titles/creation dates and links to discipline; no task create/assign/review action on that page | Authorized Admin/Administration user can create/assign/review tasks with evidence and audit trail; forbidden roles cannot |
| P1 | Notification pagination | `modules/[slug]/page.tsx` reads only the latest 50 notifications; bulk mark-read updates all unread notifications for the user | Clarify full-history visibility and bulk semantics; verify 51+ notifications and concurrent updates |
| P1 | Counterparty pagination | `counterparties/page.tsx` caps filtered results at 200 and has no next-page controls | Navigate beyond 200 records with stable ordering, retaining name and kind filters |
| P1 | Financial controls | Finance server actions exist, but transaction/RLS and approval behavior were not exercised against a live database | Create invoice → review → approve → send → reconcile → credit/remind; assert no self-approval or unauthorized edits |
| P1 | Third-party integrations | Ticketing and finance components exist; Eventix/Weeztix/SumUp live credentials and provider behavior not checked | Sandbox integration, replay/idempotency, reconciliation and outage recovery per provider |
| P1 | Multi-role mobile UX | Navigation has role-aware tabs and event-driven floating button behavior; no real device test | Test all role combinations, no cross-portal redirects, subtab close, back/forward, four locales, 320px viewport, keyboard and safe areas |
| P2 | Automation and observability | Automations module routes through shared module renderer; real scheduler health and failure recovery not verified | Confirm scheduled execution, retries, audit log, alerts and access control with controlled failure injection |

## Implementation sequence in the same PR
1. P0: Replace misleading placeholder sections with module-specific operational states and working destinations; add navigation/permission browser tests.
2. P1: Complete promotion task administration and counterparty/notification pagination; add server-side validation and RLS checks.
3. P1: Test finance, roster, inventory and ticketing flows against staging DB with representative fixtures and permission matrices.
4. P1: Verify external provider integrations using sandbox credentials; test retries, duplicate webhooks and reconciliation.
5. P0 release gate: full CI, authenticated E2E, accessibility/responsiveness, database migration check, staging smoke tests; then request explicit merge/deploy authorization.

## Status definition
`Implemented in source` is not `E2E verified`. Do not claim a completion percentage until the acceptance matrix is executed and each test has a recorded pass/fail and evidence link.
