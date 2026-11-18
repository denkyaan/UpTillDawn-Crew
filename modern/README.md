# UpTillDawn — local-first migration candidate

**Status: ISOLATED / NOT PRODUCTION-READY.** This is a deliberately partial, functional read-only migration candidate, not a replacement for the existing Main app. No GitHub Actions workflow deploys this directory. The five approved workflows remain unchanged. Production must never be switched automatically.

## Goal

Replace Next.js/OpenNext's per-navigation SSR with Vite/React Router static assets; Cloudflare serves ordinary SPA navigation without invoking a Worker. A minimal Hono Worker handles only explicit `/api/*` requests. The browser talks directly to Supabase with its public key and the **existing live RLS policies**; its own role state is never an authority to write financial or operational data. Keep PWA, offline operations, translation, OCR, and exports on-device where safe.

## Already implemented in this candidate

- Separate Vite/React build and Hono Worker config, without modifying production or Main's deployed app.
- Signed RLS session context using `upt_current_session_context`, real role and account approval checks; portal assignment visibility resolved via `upt_my_portal_assignments`.
- Read-only upcoming Events, personal Tasks, accessible channel names, and authorized financial summary; bounded queries and user-scoped offline *read* snapshots.
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
