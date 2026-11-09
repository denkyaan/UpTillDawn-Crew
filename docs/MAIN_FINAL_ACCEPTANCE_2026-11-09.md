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
| OCR invoices/inventory | Cloudmersive PDF/photo OCR with bounded file validation and human-review preview inside existing finance screen | Configure secret `CLOUDMERSIVE_OCR_API_KEY` for **main**; test live recognition, structured invoice-line validation, and Admin-approved stock receipts |
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

## Reproducible browser QA (new)

The browser runner now has `playwright@1.65.0` and `playwright-core@1.65.0` pinned in `package-lock.json`. The project supplies `npm run e2e:portals` for six-role, four-language, mobile/desktop, denial and navigation checks. The ordinary fast CI **imports Playwright**, validating that the test dependency really installs; it does not silently mark the authenticated browser suite as passed.

Use the **existing** `CI main` workflow's `workflow_dispatch` option `run_six_role_acceptance=true` after supplying twelve GitHub Actions repository secrets:

- `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`
- `E2E_ADMINISTRATION_EMAIL` and `E2E_ADMINISTRATION_PASSWORD`
- `E2E_PROMOTION_EMAIL` and `E2E_PROMOTION_PASSWORD`
- `E2E_STAFF_EMAIL` and `E2E_STAFF_PASSWORD`
- `E2E_RESPONSIBLE_EMAIL` and `E2E_RESPONSIBLE_PASSWORD`
- `E2E_MAKER_EMAIL` and `E2E_MAKER_PASSWORD`

**Dedicated isolated QA identities only**, never real crew logins, owner personal credentials or service-role keys. The existing 15-bot fixture seeder only permits a **local Supabase instance on port 54321**, or the isolated main-test project with explicit `UPT_QA_ALLOW_MAIN_SEED=1`; Production and other database hosts are blocked. The full local CI uses this safe local path. The manual job installs Chromium and tests only `https://uptilldawn-main.uptilldawn.workers.dev`. Its structured JSON report and failure screenshots are retained as a restricted GitHub Actions artifact for seven days. A failed or blocked run is not a release approval.

Local equivalent: `npm ci`, `npx playwright install --with-deps chromium`, configure the same environment variables plus `E2E_BASE_URL`, and execute `npm run e2e:portals`. The runner explicitly rejects the production URL. The browser QA job remains inside the **existing** CI main workflow: the five-workflow policy is unchanged.

## Required external actions
Supply distinct isolated QA accounts for six roles, connect intended accounting/Peppol/ticketing/scanning/signing providers, select an OCR provider, and approve any additional Supabase restore-test project costs. Do not supply private credentials through repository source or a public issue.

## Cloudmersive OCR module (main)

The existing Finance page now contains a protected **Invoice/receipt OCR** panel. It accepts PDF, JPEG and PNG up to 5 MB. Explicit upload sends the file to a fixed Cloudmersive endpoint with a **server-side secret**, never to a client-selected destination. The server checks the actual file header, request origin, live Administration permissions, response size, timeout and provider error.

Configure `CLOUDMERSIVE_OCR_API_KEY` in the **main Cloudflare Worker secret store** (not a public `NEXT_PUBLIC_` key or repository code). When absent, the API fails closed with HTTP 503 and an actionable UI error; no fabricated extraction is returned. Cloudmersive's official API specifies `Apikey` header, `/ocr/photo/toText` for a phone photo and `/ocr/pdf/toText` for scanned PDFs. The provider can incur usage charges. Never commit the key.

OCR text is a **review-only suggestion**. The original invoice must be checked, and finance/inventory state is unchanged until the existing validated invoice-row import and Admin-only receipt workflow. No provider authorization, OCR accuracy, or automated financial extraction has been verified with a live key. This module is integration-ready, **not production-certified**.

Official API reference: https://api.cloudmersive.com/docs/ocr.asp

### Asynchronous PDF OCR processing

Cloudmersive can return `AsyncJobStatus: STARTED` for long scanned PDFs. The main integration now supports the provider's documented `/ocr/pdf/get-job-status` endpoint. It creates a 15-minute HMAC-signed, user-bound job token (signed with the server-side provider secret), polls from the authenticated Finance panel, and resumes when the provider reports completion. The raw provider job ID is never accepted directly or placed in the browser URL. Polling is rate-bounded (12 checks per UI action, 2.5 seconds apart); the user may retry if the PDF is still being processed. User changes/file changes invalidate the in-progress browser request and expired tokens must be restarted with a new upload.

The endpoint applies the same authenticated Administration access check and same-origin requirement to **both** upload and polling, validates returned response sizes even without a `Content-Length` header, and never writes recognized text to invoices or inventory. The signing checks are covered by regression tests (wrong user, invalid signature, tampered and expired token). This proves code-level protections, **not** that an actual Cloudmersive key is configured or that OCR has passed an authenticated live document test. Provider API reference: https://api.cloudmersive.com/docs/ocr.asp

### Live OCR verification — 9 November 2026

An isolated main-only OCR smoke test is available via `/api/diagnostics/cloudmersive-ocr`. It requires a cryptographically verified GitHub OIDC identity scoped exactly to `denkyaan/UpTillDawn-Crew`, workflow `Deploy main`, and `refs/heads/main`. It sends only a synthetic image with text "UPTILLDAWN OCR TEST", never personal documents or user credentials, and reveals no API-key values.

Confirmed observations from main deployments:
- [Run 42664525280](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/42664525280): secret binding **present**, unauthenticated user upload rejected **401**, signed synthetic call reached Cloudmersive but failed with an upstream HTTP error.
- [Run 42665493867](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/42665493867): secret binding **present**, unauthenticated upload rejected **401**, scanned-image OCR endpoint returned upstream **HTTP 405 Method Not Allowed**. Live OCR remains **unverified / failing**; key presence alone does not prove OCR entitlement or a working provider endpoint.
- A subsequent diagnostic run inspects redirect metadata and the upstream Allow header without showing credentials, provider response text, or any document content.

The live OCR provider check is intentionally `continue-on-error` in **Deploy main**. Provider failures remain warnings and a separate manual acceptance blocker, not evidence that the Cloudflare deployment failed. Never report live OCR as passing until a successful verified result with expected test text is recorded. Production is unchanged.

## API-minimal operating mode — local OCR first

**Decision:** UpTillDawn should perform tasks locally or inside its existing first-party app/database wherever practical. Paid external APIs are opt-in, not prerequisites for the ordinary crew and finance flows.

- **Invoices, receipts and inventory:** The Finance page defaults to `LocalDocumentOcrPreview`. JPG/PNG OCR uses Tesseract.js v7 + locally served WebAssembly and NL/FR/EN/DE traineddata. PDF.js v5.4.149 extracts selectable PDF text first; scanned pages are locally rasterized for OCR. These operations are performed **entirely in the browser** and do not POST documents to Cloudmersive, Supabase Storage or other services. File size is limited to 5 MB and PDF length to 12 pages to protect phone memory. Every result is manually verified; there are no automatic financial postings or inventory mutations.
- **Assets:** The build runs `scripts/prepare-local-ocr.mjs`, which downloads version-pinned open-source JS, WASM and traineddata during CI/build and packages them into `public/vendor/ocr`. Clients download them from the **same UpTillDawn origin** on first use. The app's existing service worker caches these public OCR assets after use. A first download requires connectivity; offline processing can work after the necessary files are cached, subject to mobile browser storage quotas.
- **Cloudmersive:** The protected provider endpoint remains installed for compatibility and troubleshooting, but the normal Finance UI no longer calls it and **no Cloudmersive key is required**. Its synthetic provider diagnostic is now opt-in through the existing GitHub variable `ENABLE_CLOUDMERSIVE_OCR_TEST=true` rather than executed on every main deployment. Any retained secret may be rotated or removed by the owner when no other feature depends on it. The separate Supabase malware scanner may still use Cloudmersive, so **do not remove its secret without checking that scanner**.
- **Peppol:** Belgian regulated structured invoice delivery remains an external-network operation, and a certified access point/provider may still be necessary. UBL generation and validation should stay in UpTillDawn until a delivery provider is selected.
- **Banking/ERP, ticketing, SumUp and signing:** Prefer existing validated CSV/file imports, operator-entered records and manual checks first. Automated provider APIs should be added only when they deliver a demonstrated benefit and user approval.
- **Validation status:** Source checks, normal CI, local file-type rejection and deployed static asset smoke tests are necessary but not sufficient to certify OCR accuracy. Test on a real iPhone with a camera JPG and a scanned PDF before calling the module fully accepted. No official Cloudmersive usage charge is needed for standard browser-side OCR.

These local OCR assets are open-source software dependencies, **not external API integrations**. There is still a one-time build-time dependency on the public package/model mirrors; failures to retrieve those exact pinned assets must fail the build rather than fall back to untrusted runtime scripts.
