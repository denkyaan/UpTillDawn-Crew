# UpTillDawn — final acceptance register (main)

**Date:** 2026-11-09 (Europe/Brussels)
**Scope:** `main` (development/test app and isolated test database). Production remains unchanged without explicit authorization.

## Evidence standard
Source present, passing Node tests, successful Cloudflare deployment, authenticated browser acceptance and an actual third-party transaction are different kinds of evidence. No completion percentage or '100% finished' claim is justified without signed-off end-to-end results.

At the start of this bundle, the last verified main commit was `56c2a866174f17bbd7c451b5a7f17ac2db039419`: [CI main](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/42636833348), [Deploy main](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/42637063209). The new bundle requires its own CI/deploy evidence.

Read-only main database check, 2026-11-09: last migration `20261109143414`, offline failures `0`, stale offline operations `0`, open sessions `0`. This point-in-time test does not prove production recovery or a live event.

Additional live **read-only** RLS inspection on main, using existing approved accounts with their actual PostgreSQL authenticated role and emulated JWT subject inside read-only transactions (no changes made):

| Test | Visible fixed conversation channels | Result |
| --- | --- | --- |
| Admin | Promotion, events, Admin/Administration | PASSED |
| Administration assignment | Promotion, events, Admin/Administration | PASSED |
| Responsible | Events only | PASSED |
| Ordinary Staff | Events only | PASSED |
| Anonymous (anon DB role) | Permission denied on the channels table | DENIED |
| Promotion-only identity | Not available in current main QA accounts | BLOCKED / UNTESTED |

These checks support **channel data visibility only**; they do not constitute a full UI chat test, message send/read receipt flow or role revocation E2E test. To make the mobile bug regression reproducible, the browser harness now explicitly asserts the applied HTML language and clicks the **Finance → Banking** Administration subtab, requiring navigation to remain in Administration and the expanded subtab region to close.

## Six-role acceptance matrix
| Role | Representative flows | Browser acceptance | Real-device acceptance |
| --- | --- | --- | --- |
| Admin | Approvals, planning, operations, chat, reporting, management | Authenticated run still required | Not independently confirmed |
| Administratie | Finance, booking, rosters, promotion moderation, notifications | Authenticated and mutating workflow run required | Not independently confirmed |
| Promotie | Tasks, evidence, promotion chat, private chat, staff status | Authenticated send/read/upload and strike tests required | Not independently confirmed |
| Personeel | Events, briefing, shifts, check-in, breaks, help | Live user journey with persistence required | Not independently confirmed |
| Verantwoordelijke | Planning, workplace authority, approvals, time corrections | Authority/denial and workflow tests required | Not independently confirmed |
| Maker | Owner chooser, normal app, God Mode | Owner-only plus non-owner denial test required | Not independently confirmed |

Enhanced `scripts/e2e-all-portals.mjs` covers all six independent QA identities, four locales (nl, fr, en, de), mobile (390px) and desktop (1280px) viewports, role routes, cross-portal denials, browser errors and horizontal overflow. It writes `test-results/final-acceptance/report.json` and does not mutate accounts, money, shifts or production data.

Run only on localhost/isolated QA, or against main-test with explicit `E2E_ALLOW_MAIN_TEST=1`. Requires `E2E_BASE_URL` and `E2E_<ROLE>_EMAIL` / `E2E_<ROLE>_PASSWORD` for ADMIN, ADMINISTRATION, PROMOTION, STAFF, RESPONSIBLE and MAKER. Missing credentials mean **BLOCKED**, not PASS. Never commit credentials. The dedicated administration, promotion, SQL/RLS and 15-bot suites are additionally required to prove mutating workflows.

## External and security gates
| Dependency | Code available | Missing live evidence |
| --- | --- | --- |
| Peppol | UBL preparation and validation | Access point, recipient discovery, actual delivery and receipt |
| Bank/accounting | Statement import and reconciliation | Authorized bank-specific sandbox and accounting sync |
| Documenso | Signing client and audited ledger | Deployed service, callbacks, signed artifact archive |
| OCR invoices/inventory | Partial workflows; no validated live OCR integration | Provider, recognition, validation and inventory extraction |
| Eventix/ticketing | Import and mapping UI | Real provider sandbox, idempotent callbacks, reconciliation |
| Weeztix | Entrance scanner component | Authorized live scan and entry result |
| SumUp | No verified complete connector | Authenticated sandbox transaction and merch/token settlement |
| Promotion evidence | Upload, review and discipline | End-to-end social proof verification, 3-strike/block/unblock |
| Disaster recovery | Restore verification script | Physical backup restored to a new isolated Supabase project and verified |
| Supabase Auth | App password policy | Verify leaked-password protection in hosted Auth |
| Production release | Separate CI/deploy workflow | Explicit approval, database validation and production smoke |

Source files do not prove provider credentials or successful external transactions.

## Operating policy
- Main is the only development/test app. Staging was removed. Production remains separate.
- Exactly five approved workflows: Cleanup, CI production, Deploy production, CI main, Deploy main.
- A normal main push must not trigger production CI. Production promotion requires an explicit instruction.
- The retired `/admin/release` URL remains a redirect. Release/recovery signals live inside existing Platformbeheer, with no extra menu.
- `node scripts/final-main-acceptance-inventory.mjs` generates a static report and explicitly leaves authenticated E2E and external delivery unverified.
- Even with a green CI/deploy on main, production acceptance remains blocked pending separate evidence.

## Required external actions
Supply distinct isolated QA accounts for six roles, connect intended accounting/Peppol/ticketing/scanning/signing providers, select an OCR provider, and approve any additional Supabase restore-test project costs. Do not supply private credentials through repository source or a public issue.
