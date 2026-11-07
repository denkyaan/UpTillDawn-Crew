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
- Load the independent finance registers concurrently, then request balances using the returned document IDs. Failed balance lookups still prevent an incomplete ledger from rendering.
- Preserve open forms when the first service worker claims the page. Only a different, replacing worker may request the existing queue-safe update reload. The previous behavior was reproduced in a browser: a full document navigation began while a submitted form was still processing.
- Supply system sans/monospace font fallbacks when Geist is unavailable, avoiding an unintended serif interface.
- Reserve space below the Admin chat composer for the persistent AI button so it cannot cover the input and send controls.
- Browser navigation waits for visible page content rather than idle background requests. Production TLS behavior is unchanged; the local proxy certificate exception requires an explicit test-only environment flag.

## Verification results

- `npm test`: 1,087 passed, zero failed.
- Five server-page behavior tests execute the actual TypeScript/JSX pages with a read-only in-memory database. They verify page-two query offsets, previous-page links and preserved literal search filters.
- ESLint: zero errors; two pre-existing warnings in unrelated files.
- TypeScript and Next.js production build: passed.
- Previous finance bundle: 12 real local PostgreSQL concurrency/permission scenarios passed, including a reproduced lost-total regression.
- Three controller-change behavior tests execute the PWA component with controlled browser events: initial activation and duplicate events preserve the page, replacement workers reload, and queued crew data delays an update. The first two failed against the previous component and passed after the correction.
- Two finance-loading behavior tests execute the actual page: independent reads start together, balance reads wait for IDs, and ledger lookup failure remains closed.

These local results do not certify every application control or external provider integration. A compatible isolated Chromium headless shell now starts in this environment. Two authenticated HTTP finance reads completed with full rendered bodies. Seven authenticated browser workflow checks passed: counterparty normalization, dated event-linked invoice/line/review creation, employee approval denial, Admin approval, replay-safe stock receipts, replay-safe ticket import, and atomic conflict/permission/origin rejection. Focused permit checks verified Admin approval, employee completion, payroll denial and in-portal marketing navigation. A fresh case submission also updated its UI without reloading; the slow proxy run took 43 seconds, exceeding the previous 30-second test limit.

The five-role script supports bounded explicit timeouts, a maximum of three read-only pages, and resuming completed checks without repeating writes. It waits for route skeletons to disappear and redirects to finish, rather than assuming every valid empty state has a heading. It checks device language, mobile overflow and Admin chat control overlap. Final role-matrix, cleanup and CI evidence is tracked in [PR #162](https://github.com/denkyaan/UpTillDawn-Crew/pull/162).

## Main test database alignment

Seven recent repository migrations were validated in a rolled-back transaction, then applied to the existing main test database: provider mappings and permissions/index, promotion evidence state enforcement, Admin task edits, and finance concurrency. Migration history was aligned to the source filenames; the latest version is `20261107184322`. The reminder revision column and invoice line locking trigger were checked after application. Production was not migrated or deployed.

Five isolated test accounts were created and password authentication succeeded for Admin, Responsible, Staff, Administration and Promotion. The user authorized resuming tests and cleanup after the environment was identified. Three SQL suites passed against main-test: finance lifecycle and settlement, ordinary-staff RLS denial, and administration workflow/permissions. Each suite rolled its transaction back. Workflow assertions included 5,400 net payroll seconds, denied employee approval, four deadline recipients and zero duplicate deliveries on a repeated run. Browser fixtures are scoped to the dedicated QA users and one QA event; generated credentials are excluded from Git. The scoped cleanup result is tracked in PR #162.

## Remaining acceptance work

- Finish authenticated role navigation, real forms, permission denials and mobile interaction checks, then clean up the five dedicated test accounts and their fixtures.
- Complete the application acceptance matrix before any claim that the entire platform is finished. Passing unit tests and a build are not a completion percentage.
- Keep production release independent from this feature branch; full production CI and the established release gates still apply.
