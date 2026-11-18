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
