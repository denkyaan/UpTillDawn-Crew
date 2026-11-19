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
