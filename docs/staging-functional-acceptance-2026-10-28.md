# UpTillDawn Crew — staging functional acceptance (2026-10-28)

## Verified CI evidence

- Branch: `staging`, commit `0a4b8bf81a86a139bdc4bf120095d629943cde3c`.
- Full CI: https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/40686211578 — **success**.
- Fast Change Validation and Deploy Staging at that SHA — **success**.
- Full CI job passed: six-domain source-contract acceptance, Next.js and Cloudflare builds, clean migration replay, SQL regression suites, generated database types parity, 15 authenticated browser bots, and browser action persistence.
- **Scope limitation:** CI browser bots run against an isolated local database and app. They are not proof of actual staging role accounts, real credentials, external services, push delivery, or live financial operations.

## Acceptance matrix

| Area | Automated evidence | Real staging acceptance still required |
| --- | --- | --- |
| Registration, login, approval, multi-role | Auth and portal navigation source-contract tests; CI browser bots | Real new user, approval/revocation, multi-role switch and all login paths |
| Admin / Responsible / Staff | 15-bot event lifecycle, SQL privilege and persistence tests | All real mobile tabs, check-in GPS, break and timesheet approvals |
| Administration | SQL migrations and unit/contract tests | Each of six bottom tabs and subtabs, links, no 404, invoice/document lifecycle, approval boundaries |
| Promotion | Source-contract tests for tasks, evidence, suspension and discipline | Instagram/Facebook deep links, reference evidence, review states, strike/block lifecycle and reinstatement |
| Chat and notifications | Chat SQL regressions and PWA/push contracts | Actual private/group chat, mentions, push delivery on iOS/Android |
| Inventory, sales, guestlist, driver | Event lifecycle and persistence checks | Real event records, stock and money reconciliation, driver trip/GPS and arrival alerts |
| AI | Read-only and booking-note contract tests | Real configured AI inference, human confirmation and audit |
| Accounting / Peppol / banks | Internal models and API contracts | Provider connection, authorization, end-to-end transmission and reconciliation |
| Languages / accessibility | Static i18n tests | Human visual review NL/FR/EN/DE, phone layouts, keyboard and screen-reader paths |
| Staging deployment | Deploy Staging workflow passed | Authenticated smoke of the deployed URL and cross-portal journeys |

## Blocking conditions for production release

1. Complete real staging smoke with test accounts for Admin, Responsible, Staff, Administration, Promotion, Maker (restricted) and multi-role users.
2. Confirm no broken routes or 404 in Administration's six-tab navigation and Promotion's two-button overview; verify functional forms and server-side authorization.
3. Exercise actual notification delivery, file uploads, screenshot evidence review, suspension/reinstatement, and a complete event with driver and payroll exports.
4. Mark external Peppol/accounting/banking integrations **unconnected** unless real provider configuration and end-to-end delivery receipts are demonstrated. Screenshot similarity alone is **not** proof of social publication.
5. Validate database migrations and data preservation in the target environment; perform backup and rollback rehearsal before production.
6. Sign off the four-language mobile walkthrough and record observed results, failures and fixes.

## Release decision

**Automated release gate: PASS. Real staging functional acceptance: NOT YET VERIFIED. Production sign-off: BLOCKED.**

Do not infer feature completeness from green CI or source-code pattern tests. Record actual staging test evidence before changing this decision.
