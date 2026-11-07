# Platform verification — 2026-11-07

## Current deployment mapping

Verified against the workflow files on `main`, not inferred from project names:

| Application | Worker | Supabase project |
| --- | --- | --- |
| Main test app | `uptilldawn-main.uptilldawn.workers.dev` | `npbjrtiolqperdgljnhi` (legacy project name `uptilldawn-staging`) |
| Production | `crew.uptilldawn.workers.dev` | `eakoavcieossazqzplke` |

Feature changes remain on `feature/administration-completion-bundle`, PR #162. A legacy database name does not identify an active staging branch or deployment workflow.

## Implemented bundle

- Repair pagination in shared notifications, the administration notification module, counterparties, promotion administration and promotion assignments. Valid page numbers previously failed over-escaped regular expressions and silently selected page one.
- Reuse strict page parsing and literal SQL LIKE escaping. Counterparty edits retain page and search context; promotion/counterparty searches escape `%`, `_` and backslash correctly.
- Align invoice filters, details and overdue counts with the persisted `void` status. Closed invoices and unapproved drafts are excluded from overdue calculations; dates use Europe/Brussels. Invoice status labels are localized.
- Replace generic Administration preview notices and repeated unavailable cards with descriptions of the workflows actually present, in all four languages. Existing actions and permission gates remain in place. Deadline history no longer sits beside contradictory text saying there are no automatic rules.
- Add a reusable five-role route smoke script. It requires explicit local-app and main-test fixture configuration and is not part of the fast CI dependency install.

## Verification results

- `npm test`: 1,082 passed, zero failed.
- Five server-page behavior tests execute the actual TypeScript/JSX pages with a read-only in-memory database. They verify page-two query offsets, previous-page links and preserved literal search filters.
- ESLint: zero errors; two pre-existing warnings in unrelated files.
- TypeScript and Next.js production build: passed.
- Previous finance bundle: 12 real local PostgreSQL concurrency/permission scenarios passed, including a reproduced lost-total regression.

These local results do not certify authenticated browser journeys, every application control or external provider integrations. Chromium could not start in this execution environment because its required Unix socket was denied. The attempted HTTP workflow did not produce a completed result. Browser/HTTP acceptance remains open.

## Main test database alignment

Seven recent repository migrations were validated in a rolled-back transaction, then applied to the existing main test database: provider mappings and permissions/index, promotion evidence state enforcement, Admin task edits, and finance concurrency. Migration history was aligned to the source filenames; the latest version is `20261107184322`. The reminder revision column and invoice line locking trigger were checked after application. Production was not migrated or deployed.

Five isolated test accounts were created and password authentication succeeded for Admin, Responsible, Staff, Administration and Promotion. A later read-only check confirmed zero test-created events and zero financial documents. Further writes were stopped after environment clarification and automatic approval review rejected continuing the write tests. Account cleanup requested explicit confirmation; that confirmation expired, so the five accounts have not been removed. Their generated credentials are excluded from Git.

## Remaining acceptance work

- Obtain authorization to resume writes in the now-identified main test environment and clean up the five test accounts.
- Execute authenticated role navigation, real forms, permission denials and mobile interaction checks. Run the prepared route smoke test and the existing administration completion workflow in a browser-capable environment.
- Complete the application acceptance matrix before any claim that the entire platform is finished. Passing unit tests and a build are not a completion percentage.
- Keep production release independent from this feature branch; full production CI and the established release gates still apply.
