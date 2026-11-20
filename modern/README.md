# UpTillDawn — original Main source migration

**ISOLATED / NOT PRODUCTION-READY. Production cutover remains blocked.**

The Vite candidate now loads the authoritative Main pages, AppLayout, Sidebar,
Topbar, mobile bottom navigation, portal layouts, floating chat and AI controls.
The earlier simplified screens are retained only as inactive prototypes for
existing data-boundary tests. They are not registered in the running app.

The source adapter converts async view composition to route-scoped React
Suspense. It retains the original JSX, queries, validation and role guards.
Static navigation does not invoke a Cloudflare Worker. Ordinary signed-user
reads use the existing Supabase RLS policies. Server-only imports and private
environment reads fail the browser build unless explicitly audited adapters
provide public DTOs. No Next runtime is included in the Vite client.

Original server actions execute through a generated static allowlist, retaining
all original validation, authorization, audit and revalidation. Inline actions
are generated verbatim from their source with a TypeScript symbol dependency
graph; generated files must pass `generate-original-actions.mjs --check`.
Existing API route/method pairs use a bounded streaming QA-only Main service
binding. Unknown paths, forged hosts and cross-site mutations are rejected.
The original credential, email callback and provider-delivery gates remain.

The three authentication routes compile directly from the original Main source
into native Worker code. Both Main and the candidate execute that same source
without invoking Next's request handler. Request-scoped cookies and private
environment values remain isolated across concurrent users. Main exposes only
the audited mail/location configuration through a named internal service
entrypoint; database administration, deployment and provider credentials are
excluded. Publish Main before the candidate resolves this binding. Real login
QA requires the native-runtime response header, with no password retry or
fallback to the legacy handler. A single recorded retry is allowed only for
read-only reference-page rendering; it does not certify legacy runtime health.

God Mode's HttpOnly credential stays on the server. An opaque reference can
request only two fixed RPCs after an independent owner and actual cookie check.
No browser authority, raw token, encryption key or service-role key is added.

Main continues serving the existing Next app. The isolated modern-main host
receives this candidate through the approved Deploy Main workflow. Production
CI/deployment is never triggered by migration work. The five approved workflow
files remain the only workflows.

Pending acceptance: all pages and actions, all seven role bots, four locales,
mobile/desktop layouts, mutation/error/revocation/offline journeys, mail
verification/recovery, God Mode and provider account connections. The 30+
simultaneous sessions API check remains separate from full UI acceptance.
Source reuse, passing builds, control comparisons and login screenshots do not
prove complete visual/functional parity. No existing Main or production entry
is replaced until that complete evidence exists.

Commands: `npm run build`, `npm run budget`, `npm run api:test`,
`npm run browser:qa`, `npm run login:visual-parity`, `npm run inventory`.
The inventory and login cutover gates deliberately remain fail-closed.
