# UpTillDawn — local-first migration candidate

**Status: ISOLATED / NOT PRODUCTION-READY.** This is a deliberately partial, functional, read-mostly migration candidate, not a replacement for the existing Main app. No GitHub Actions workflow deploys this directory. The five approved workflows remain unchanged. Production must never be switched automatically.

## Goal

Replace Next.js/OpenNext's per-navigation SSR with Vite/React Router static assets; Cloudflare serves ordinary SPA navigation without invoking a Worker. A minimal Hono Worker handles only explicit `/api/*` requests. The browser talks directly to Supabase with its public key and the **existing live RLS policies**; its own role state is never an authority to write financial or operational data. Keep PWA, offline operations, translation, OCR, and exports on-device where safe.

## Already implemented in this candidate

- Separate Vite/React build and Hono Worker config, without modifying production or Main's deployed app.
- Signed RLS session context using `upt_current_session_context`, real role and account approval checks; portal assignment visibility resolved via `upt_my_portal_assignments`.
- Upcoming Events, personal Tasks, chat channels with bounded Realtime message history, and authorized financial summary; bounded queries and user-scoped offline *read* snapshots. Event availability, personal task confirmation/status, chat text/read receipts and idempotent offline chat text outbox reuse existing authorization/audit RPCs. **All candidate writes are OFF by default and not available to real users.**
- Device-localized navigation baseline (NL, FR, EN, DE); service worker caches only public static assets.
- Explicit module boundaries, safe denial on unported pages, no fake financial balances or completed workflows.
- Authenticated API example `/api/v1/session` with bearer-validated claims and PostgREST RLS, never a service-role key.

## Still to migrate (blocking a cutover)

All existing write workflows and seven full role journeys: QR check-in/check-out, deadlines, briefings, responsibles' workplace tasks, direct chat + Realtime + translated threads, admin scheduling and approval, payroll, inventory and incident handling, EventPay RFID/QR, Weeztix scanning, complete financial and invoice signing/Peppol, promotions, full God Mode, maker error triage, PWA offline replay/push, and all existing 101 pages/61 API routes. Existing Next login has security auditing and portal-mode switching that must be carried across before switching real users to this candidate.

A migration that merely redirects these screens to the old server would not solve Worker CPU overruns; no such deceptive fallback exists.

## Run locally (after setting up dependencies)

```sh
cd modern
npm install
cp .env.example .env.local
# configure ONLY the public Supabase URL/key
npm run dev
# separate terminal, for Worker-only API testing:
npm run dev:api
npm run build
npm run deploy:dry-run
```

The isolated `modern/wrangler.jsonc` has `workers_dev:false`, `preview_urls:false`, and no production secrets/deployment workflows. No public endpoint is provisioned by this branch.

## Release gates

1. No user-facing cutover until every existing portal, action, job and permission matches the current app; offline workflows must be conflict-safe.
2. Test **all seven role bots**, all four languages, desktop/mobile and 30+ simultaneous sessions (real browser and real RLS/Realtime), including forbidden actions and logout/session revocation.
3. Profile Workers Free CPU per request, `exceededResources` after deployment, memory, bundle sizes, network query count, and page hydration/interaction. A green build is not a green application.
4. Validate all external service login/connection flows; no external credentials from the user are required to initialize the platform.
5. Keep Main fast CI; run full release gates before Production **only after explicit owner authorization**.

## Trust boundaries

- Browser and IndexedDB are untrusted; user ID is a storage namespace, not an authorization check. Local read snapshots are discarded on logout; never cache finance, OTP, tokens, signed media URLs, service keys or privileged Maker data.
- Password and access-token validation is delegated to Supabase Auth/PostgREST and role approval checks; no browser-assigned Admin role.
- Replacing Next Server Actions requires individually mapped RLS/SECURITY DEFINER RPCs or authenticated Hono endpoints with audit and replay/idempotency controls. Do not blanket-migrate actions to direct browser table mutations.
- Only public static shell assets are service-worker cached. Requests to `/api/*` never enter that cache.

## Static-service-worker isolation

Vite's publicDir is deliberately `modern/public` rather than the legacy root `public/`. This prevents accidentally packaging the previous production service worker, legacy scripts, debug pages and large offline assets into the candidate. Any needed offline capabilities must be audited and ported individually. The candidate manifest and service worker intentionally expose no production credentials.

## Modern interaction transport (migration candidate only)

- Staff task confirmations and status updates call the existing `upt_confirm_task_assignment` and `upt_update_task_status` RPCs after live auth checks. Both RPCs check assignment ownership, shift/feature constraints and audit state changes.
- Text chat uses one selected-channel Realtime subscription, 100-message window, on-demand local translation roadmap and idempotent `upt_send_chat_message_operation_v2` with a stable operation UUID per queued message. Offline outbox is capped at 50 per user and is purged on sign-out, account denial or identity switch. Failed sends are *queued*, never misreported as delivered.
- Chat read receipts use `upt_mark_chat_read`, which verifies channel access server-side. The modern candidate still lacks the current app's auto-translation, attachment signing, read-avatar details, group management and moderation UI, so chat parity is **not** achieved.
- The write gate `VITE_MIGRATION_ALLOW_WRITES` defaults to `false` and must remain so until full E2E and data integrity approval.

## Isolated Worker validation

The existing fast Main CI stays unchanged in normal runs. The migration-only PR gate now also **bundles the Hono Worker with Wrangler using dry-run** and audits the candidate's production dependencies. This checks Worker packaging without publishing a Cloudflare deployment; a future live preview must additionally measure actual CPU/memory under seven-role and 30-user load. No production credentials or user OAuth logins are required for this packaging check.

## No-downgrade inventory

Every existing Next page route, API route and exported server action is counted by `npm run inventory`. Partial pilot screens are explicitly labelled **candidate-not-parity**; nothing is counted as fully migrated until a verified comparison exists. `node scripts/inventory.mjs --routes` prints the complete path inventory, and `--enforce-parity` fails closed to block any accidental production cutover. This inventory does **not** claim that an API route has been implemented simply because a React screen with the same name exists.

## Operational local-first migration bundle (candidate, no cutover)

- New lazy, accessible, role-scoped screens for personal shifts/check-in history/registered hours; event/workplace briefings; operational workplaces/inventory/incident history; responsible assignment/event roster; notifications; minimal self-profile; promotion tasks; and an integrated Administration documents/payments/inventory overview. Each opens a bounded PostgREST read **directly from the browser** under the signed user's existing RLS policy — ordinary navigation never renders a Next server component on Cloudflare.
- Financial documents/payments, notification bodies, profile fields, incidents, work sessions and briefings remain **ephemeral in memory**: there is no IndexedDB/service-worker snapshot for these sensitive surfaces. A live identity switch immediately resets the displayed scope. Responses are never re-used across accounts.
- Existing `upt_acknowledge_briefing`, `upt_confirm_shift` and `upt_acknowledge_incident` database RPCs are connected only under the migration's OFF-by-default write gate, with live session verification. Their authoritative checks for auth.uid(), permitted workplace and event state are preserved.
- Each multi-tab section loads **only the selected** dataset. No global polling, eager 16-collection refresh or duplicate admin action buttons. Navigation adapts to verified portal assignment; God Mode and other incomplete workflows remain explicitly unavailable rather than simulated.
- Exportable shifts, inventory and approved financial document lists generate CSV **on the user's device only**, via a lazy module that neutralizes Excel-formula injection. This is CSV (Excel compatible), not a false claim of .xlsx format or bank reconciliation. CSV downloads are explicitly user-initiated.
- This is a **large partial migration, not parity**: full four-language operational content, edit forms, payroll, staff approvals, contractor contracts, Peppol, bank reconciliation, OAuth integrations, event ticket verification, QR/GPS check-in, full God Mode, chat media/translation and all original routes remain unported. A green build/Worker dry-run cannot prove production safety.

## Per-device request budget (preventive overload mitigation)

A shared browser-only scheduler caps ordinary PostgREST reads at **3 simultaneous requests per device**, with at most **16 queued requests** and a 12-second per-screen abort signal. It is used for Events/Tasks/Channels, sensitive RLS-only operational screens, chat history and finance summary. Aborted queued reads are removed without ever starting a query; there is no retry storm, polling loop, globally cached private response, new Cloudflare endpoint or change to authenticated writes. This is a *per-device* bound, not a global Supabase capacity guarantee. Actual 30-identity/per-role stress and post-deployment Cloudflare telemetry remain mandatory.

## Hono API security smoke tests

The migration-only CI validates the assembled Hono Worker directly with `npm --prefix modern run api:test`, checking no-store headers, anonymous 401, malformed bearer rejection, absent-provider fail-closed 503, and unknown-route 404. This runs without contacting Supabase or deploying Cloudflare. It does **not** replace live seven-role RLS penetration tests after final migration.

## Extended operational migration bundle (read-only)

The parallel local-first candidate now has **ten additional, lazily grouped RLS read views** without introducing a new top-level portal or Cloudflare Worker dependency:

- **Crew:** personal timesheets, time review requests, inventory issues and return settlements alongside shifts/check-ins/hours.
- **Operations:** transactions in the existing Sales tab and recent inventory movement history within the existing Inventory tab.
- **Administration:** historical ticket imports and sales, signed-contract status (only rows permitted by current RLS), and staff timesheet status.

All queries select an explicit minimal column set, abort on navigation/timeout, share the client-wide 3-active/16-queued read budget and return at most 70–100 rows. Full datasets, payments, signed documents, personal identifiers and detailed approval decisions are **not** cached. CSV export is performed locally only upon user interaction and escapes formula-injection prefixes.

**No bookkeeping, bank transfer, EventPay authorization, QR check-in, contract signature or payroll approval is claimed as migrated or verified.** Workflows that write remain gated off; the feature parity and production cutover gates remain fail-closed. The portal views are *candidates*, not finished ported routes.

## One-bundle transactional migration: QR, incidents and timesheets

This candidate implements (behind the **OFF-by-default** write gate):

- The existing server-validated QR start/stop REQUEST state machine, including shift/briefing prerequisites, contact with a responsible lead, early-start explanation, and pending-approval outcomes. The UI never calls a pending request an approved check-in. Physical QR, accurate GPS evidence, selfie capture, and reviewer E2E parity are NOT yet validated.
- Incident submission via the existing idempotent `upt_sync_operation(p_type='incident')` RPC, with explicit event/workplace selection, strict urgency/category/GPS/input validation, preserved operation UUID and GPS evidence on ambiguous retries, and no fake delivery confirmation. This initial candidate accepts text-only online reports. Legacy offline photo + malware scanning and fully durable incident queues remain to be migrated.
- Personal timesheet submission, authorized reviewer approval/rejection (with required reason), and admin-only final locking, using the existing audited `upt_submit_timesheet`, `upt_review_timesheet` and `upt_lock_timesheet` RPCs. The RPCs enforce event membership, disallow self-approval and lock state transitions independently of UI controls.
- No new top-level administration or operations tab duplication: the new timesheet workflow lives inside existing Crew and Administration sections, and the incident form lives within the existing incident view.
- Pure, tested contracts for QR state, timesheet rejection reasons and incident payloads, without any browser/backend dependencies.

This transaction bundle is implementation progress, **NOT feature parity or authorization to enable new writes**. Customer financial, EventPay, Weeztix, self-service OAuth and full Maker God Mode remain on the original secure implementation. The isolated migration branch must NOT merge or deploy until seven-role, multilingual browser tests and Cloudflare Free runtime metrics confirm parity.

## Migration candidate: read-only Maker diagnostics + scoped external connection status

- A **Maker-only** read-only diagnostics panel is linked at `/maker/diagnostics`. Hono checks the signed Supabase session, live profile and `upt_current_is_owner`, creates an ephemeral God Mode session **on the Worker only**, reads at most 20 summarized audit/recovery/error rows, and immediately invalidates the privileged session in a `finally` clause. No privileged God token, stack trace, SQL editor, credentials or client context is returned or persisted in browser storage.
- Each **existing functional Administration location** (Documents/Peppol, Payments/bank+SumUp, Tickets/Weeztix, Contracts/Documenso) shows an opt-in status check of existing connection **metadata only**. Hono requires a signed, approved session plus the independently evaluated organization-specific `upt_can_manage_integrations` permission; being the technical Maker alone is insufficient. The existing encrypted credential store and all provider credentials remain unchanged.
- The authenticated **provider-user OAuth start/callback, crypto store, rotation and acceptance** from Next/OpenNext are still NOT migrated. Provider SDK app registrations require an operator-held client ID/secret before final customers can connect using login alone. The candidate does not pretend that a provider OAuth redirect exists and never asks an end user to paste API tokens.
- Session refresh now hides the previous private view during validation, prevents stale overlapping responses from restoring a revoked user, and revalidates on tab visibility.
- Migration-only Chromium smoke covers anonymous app entry and forbidden maker route on **4 locales x 2 device profiles = 8 scenarios**, with fake public Supabase configuration and no customer credentials. This **is not** authenticated 7-role or 30-concurrent-user acceptance. Those release gates remain blocked.

## Verified database compatibility finding — 19 November 2026

The repository's Main QA deploy points at Supabase project `npbjrtiolqperdgljnhi`; the Production deploy points at `eakoavcieossazqzplke`. Read-only inspection of both projects' PostgreSQL function catalogs checked the 25 RPC names called at the time of the observation (one additional vetted Promotion RPC has since been added), `authenticated` execute grants and `anon` execute exposure. On the observation date, **Main QA had all 25 observed RPCs** and **Production lacked `public.upt_current_session_context`**. No anonymous execution grants were detected among the original 25. The additional promotion RPC was also verified in both environments as authenticated-only. No production data, schema, role or secret was changed.

The candidate depends on this RPC for every login/session and rejects the request when absent. **Do not try to handle its absence via frontend role claims, alternate service-role queries or by merging early.** The missing database contract must be investigated, safely migrated through the existing reviewed production migration path and live-tested *only as part of a separately authorized release*.

Run `npm run rpc:contract` inside `modern/` to audit the source's current RPC allowlist offline; this gate is included in candidate-only CI. Its checked-in catalog snapshot is dated historical evidence, not an actual live database probe. It always refuses `--release` because full function parity, 7-role browser journeys, 30 distinct sessions and Worker-resource measurements are not yet proven.

## Profile self-service candidate (gated)

The Profile screen now has the complete **existing self-service profile workflow** behind the disabled migration writes flag: name, phone, birth date, address, national register number, IBAN, preferred workplace and private photo upload with on-device MIME-signature validation (5 MiB maximum). The existing `upt_own_profile_details`, `upt_update_own_profile`, `upt_own_workplace_preference`, `upt_profile_workplace_options`, `upt_set_own_workplace_preference`, `upt_current_profile_completion` and `upt_mark_own_profile_complete` RPCs remain the authority. No new database schema or server proxy. Signed photo URLs expire; sensitive profile fields are never written to local storage, public PWA caches, telemetry or logs. An uploaded photo is never deleted once the profile RPC has been attempted: a timeout may conceal a successful commit. Failures report an uncertain outcome and require refresh before retry; the older photo is never deleted. Changes of workplace preference/completion are not falsely reported as an atomic success. Never delete an older linked photo during a migration.

One account's saved form does not create authorizations for another account. Real seven-role authenticated browser acceptance and full-onboarding parity remain required before enabling writes.

## Auth refresh and sign-out stability (candidate only)

The signed-session verifier now **coalesces overlapping authentication/visibility checks** into one in-flight validation. A changed signed-in user, refreshed credential, remote sign-out or component teardown invalidates stale responses, so a late async result cannot reinstate a revoked account. The initial Supabase auth event no longer duplicates the already-running initial check. Remote sign-out errors are fail-closed instead of being falsely reported as success. No client role, JWT metadata or cached permissions are trusted, and no production behavior is changed. Candidate session tests cover singleflight, invalidation and stale-response suppression; authenticated browser E2E still blocks release.

## Authenticated candidate acceptance harness — seven real QA bots

A **candidate-only** browser acceptance harness in `modern/tests/browser-auth-qa.mjs` checks all seven fixed Main-QA role accounts, their live signed portal entitlements, actual denied direct routes and localized navigation in 4 languages x 2 viewport profiles (56 authenticated scenarios). Every bot signs in once; browser cookie state is reused **only in memory** and is never stored in artifacts. All backend calls are to isolated Supabase Main QA; browser write flag is `false` and no privileged key is used. No Production endpoint or provider OAuth workflow is involved.

The existing fast CI runs the QA-only browser check only on same-repository migration pull requests when the dedicated `MAIN_QA_BOT_PASSWORD` secret is available; if not, CI states **NOT EXECUTED**, not a fictitious success. The anonymous eight-scenario browser suite remains separate. No release readiness is implied even when these route checks pass: QR, payroll, payments, owner God Mode, offline replay, provider OAuth, 30 simultaneous real sessions and every legacy operation still require specific tests.

## 30 separately signed QA sessions — measured acceptance

The candidate-only CI `sessions:qa` creates **30 separate authenticated Supabase sessions** distributed across the seven fixed Main-QA bot accounts. Each session has a distinct server-issued JWT `session_id`, and each performs a real, role-bound `upt_current_session_context` RLS read. Authentication is ramped sequentially; read load is ramped through 6, 12, and 30 concurrent requests once, with a 12.5-second p95 failure threshold. All sessions are signed out locally without invalidating other bot sessions. Secrets, tokens, user IDs and raw profile values are never logged. No production requests, business writes, synthetic request loop, or service-role key.

This proves separate QA authentication sessions and Supabase RLS reads under a **30-concurrent request peak**, not 30 distinct individuals, not full UI journey parity, and **not production Cloudflare CPU / request telemetry**. Deployment/resource acceptance remains blocked separately. The seven-role browser harness additionally checks real RLS-backed profile, notification and permitted portal reads, beyond nav links.

## Profile RLS fix (authenticated QA uncovered)

The 7-role authenticated read gate revealed that `public.profiles` is deliberately not `SELECT`-granted to the `authenticated` role in either QA or Production (verified live, read-only). The candidate profile formerly issued a direct `profiles.select` and consequently failed for the head admin. It now calls the existing signed `upt_own_profile_details()` and `upt_current_profile_completion()` RPCs, checks that the returned user ID is the currently signed user, and renders from that verified response. Duplicate own-profile reads were removed. The two optional workplace-preference RPCs run only when profile editing is enabled, not in the current read-only candidate. Do **not** open direct `profiles` grants just to make UI tests pass; this would weaken security. The other 26 direct-read tables have `authenticated` SELECT grants in both environments, but live role/RLS checks still apply per row.

## Contextual end-user OAuth — SumUp and Billit/Peppol (candidate, gated off)

The migrated Hono API provides two **explicit, user-initiated** endpoints: POST `/api/v1/integrations/oauth/start` and POST `/api/v1/integrations/oauth/complete`, plus a lazy SPA callback route. Neither is invoked on ordinary navigation. The existing integration status card in the relevant invoice/banking module exposes only verified readiness and a single provider sign-in action when **both** the browser write gate and Worker OAuth feature gate are explicitly enabled. All other providers remain read-only; **no duplicate settings hub or manually entered end-user client secrets**.

The browser asks for consent with a current Supabase bearer JWT. Hono independently validates live session/role and `upt_can_manage_integrations`, plus exact HTTPS origin and provider allowlist. A 600-second, 256-bit random state is bound to the actor/provider/expiry using HKDF-derived HMAC-SHA256 and an HttpOnly/Secure/SameSite=Lax `__Host-` cookie. Provider callback query strings are scrubbed from history; the SPA sends the authorization code/state back only with an authenticated same-origin POST, no-referrer. The Worker validates state before exchanging the code at a **fixed** HTTPS SumUp/Billit token endpoint; the operator's registered application secret remains Worker-only. Responses are bounded, time-limited, and never returned to the browser. Access/refresh tokens are AES-256-GCM sealed with a new 96-bit IV and provider-specific AAD, using the established `v1:` storage format, then saved through the existing permission-checked, audited `upt_integration_credentials` RPC. Browser only sees `{connected:true}`; the cookie is cleared on callback.

**No provider account login, operator-app registration, OAuth authorization-code exchange or save has yet been tested live.** The Worker defaults `UPT_MIGRATION_OAUTH_ENABLED=false` and browser `VITE_MIGRATION_ALLOW_WRITES=false`. Without an operator-registered SumUp/Billit client, exact redirect URI, Worker-side encryption key and actual end-user consent, no "Connect" button is activated. The end user should only need to authenticate with their provider; operator secrets are never requested from that user. Billit production app credentials require separate provider approval. No main/production deployment is made by this change.


## Consolidated work-time and break lifecycle (candidate, no writes)

The existing Supabase audited RPCs `upt_start_break`, `upt_stop_break`, `upt_work_session_time_summary` and `upt_decide_check_out` (available to authenticated roles on QA and Production) now power the personnel hours and responsible approval panels. A staff member sees own check-ins, **check-outs separately within the same tab**, and the active/recent work-session breakdown returned from the server; the client does NOT calculate wages or overtime. On a running break, a local on-screen reminder appears from minute 55 and a warning after minute 70. The warning consumes **no periodic network requests**, never secretly auto-stops a break and does **not** run when the page is closed. The server's one-hour allowance and excess deduction are authoritative. All start/stop actions remain behind the same OFF-by-default write gate and check session identity just before the audited RPC. An uncertain network response is never represented as success; users refresh the current server state.

Responsible personnel can review check-ins **and check-outs** in the existing approvals panel without a duplicate subtab. A check-out request does **not** end a work session until the existing `upt_decide_check_out` approves it; the server validates reviewer, rejection reason, active session and closes any open break atomically. Client never writes directly to work/break tables. Full physical QR, GPS and selfie checks are still missing and remain a release blocker. No new database migration or permission grant was made.

## Payroll + pause consistency (blocked release candidate)

A live-read of Main QA and Production found a **real inconsistency**: `upt_work_session_time_summary` deducts only break time beyond a paid 60-minute allowance, whereas `upt_administration_private.payroll_rows` deducts **all** break time, resulting in contradictory staff totals vs approved payroll export. Both also lack the agreed **10-minute tolerance trigger**. The existing historic CSV validator expects gross minus all break time, so it must be migrated *together* with the database; changing only the modern UI would be unsafe.

The reviewed but **NOT EXECUTED** file `modern/sql/break-payroll-grace-reconciliation.candidate.sql` updates the two existing SQL function bodies to share a private, non-exposed, immutable arithmetic helper. It preserves role checks, approved/locked payroll scope, validation of invalid/crossed times and audit semantics. Under the agreed policy: 60 minutes of paid break per user and event; 600 additional seconds are a tolerance **trigger**. At exactly 70:00 total break, deduct 0. At 70:01, deduct 10:01 (the whole excess beyond the paid hour). When multiple sessions exist, reassess all previous sessions as soon as event-wide total crosses the threshold, allocating deduction in chronological session order. It must be validated with isolated QA fixtures, approved timesheet/CSV reconciliation and the existing production exporter before application anywhere. No database migration history or deployment was created by this candidate.

`modern/src/shared/payroll-policy.ts` and `modern/tests/payroll-policy.test.mjs` provide bounded deterministic reference cases for single/split sessions, exact 60/69/70/70:01-minute boundaries and malformed data; they cannot substitute for true SQL execution or backend fixtures. The existing production payroll service remains unchanged until the database and CSV validator can change atomically. The 70-minute UI warning is **not** proof that payroll is correct. The migration branch remains blocked for release.

### Payroll CSV atomic consistency gate (staged, not deployed)

The database JSON wrapper will attach mandatory `policy_version=paid60-grace10-event-v1` to every payroll row; `payrollCsv` now **rejects missing/legacy versions**, prevents silently exporting an all-break-deducted legacy row as though it were new policy, and outputs actual break seconds separately from the **deducted excess**. It continues to reject duplicate sessions, unapproved timesheets, malformed UTC timestamps and unsafe numeric coercions. This exporter change and the candidate SQL wrapper MUST be deployed atomically. Until then the existing Main/Production implementation stays unchanged and the migration PR must remain Draft. Its unit tests do not authorize payroll production.

## Main-safe integration boundary — no runtime cutover

The full source for this migration is staged under `modern/` and may be
merged into `main` as an **isolated, disabled development candidate**, without
replacing the existing Next app or deploying a second Worker. It is **not** a
completed application, public deployment, or production approval.

The existing Next administration payroll implementation and its unit tests are
kept byte-for-byte identical to the pre-migration `main` version. The
**versioned candidate-only** CSV implementation lives at
`modern/src/shared/payroll-csv.ts` with tests at
`modern/tests/payroll-csv.test.mjs`. Its companion SQL is review-only under
`modern/sql`, **not** `supabase/migrations`; it has not been installed on
Main QA or Production. Without the matching DB change, that candidate exporter
must not be connected to active API routes.

Root `package.json`, `app/`, existing live API routes, database migrations,
`deploy-main.yml` and `deploy-cloudflare.yml` remain unchanged. The root
ESLint and TypeScript configurations exclude `modern/` from the Next app's
analysis; the migration uses its own independently validated TS/Vite/Worker
build. Candidate writes and OAuth login remain disabled. A normal Main push
runs the Main fast CI and existing Main deployment; Production is dispatched
**only** by a separate explicit release action. Nothing in this bundle
authorizes a production cutover, provider account setup or enabling writes.
