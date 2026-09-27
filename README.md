# Uptilldawn Crew Management

Production crew-management PWA for Uptilldawn events. The application is a Next.js 16 / React 19 app on Cloudflare Workers through OpenNext, backed by Supabase Auth, PostgreSQL/RLS, private Storage, Realtime and a Supabase Edge Function for Web Push delivery.

## Production baseline

- Canonical branch: `main`
- Primary production URL: `https://crew.uptilldawn.workers.dev`
- Public Cloudflare Worker alias: `crew` → internal production Worker `uptilldawn-crew`
- Supabase project: `eakoavcieossazqzplke`
- Desktop/web and installed mobile PWA layouts are treated as the current default baseline.
- Role navigation defaults live in `lib/role-ui.ts`.
- Contextual mobile quick tabs live in `components/layout/mobile-nav.tsx`.
- Service worker, background-refresh hooks and Web Push handling live in `public/sw.js` and the PWA components.
- Regression tests lock the approved desktop/mobile behavior so it cannot silently drift.

## What the app covers

- Staff, Responsible Lead and Admin login/role flows
- Admin approval and immutable maker/admin protection
- Events, workplaces, shifts, Staff accept/decline responses, controlled reassignment, replacement/swap/open-shift requests, revision-aware pre-shift reminders and Responsible assignments
- Check-in/check-out approval
- Server-authoritative work and break tracking
- 60-minute shared break allowance per employee/event
- Workplace transitions without double-counting time
- Briefings, personal instructions, task assignments, workplace operational checklists with photo evidence, and workplace-scoped material inventory with controlled issue/return/damage/missing workflows
- Organization/event/workplace chat and private media
- Event emergency information with offline-cached emergency number, address, first-aid/security contacts, assembly point and procedure\n- URGENT/help incidents with canonical current-workplace context, optional photo/GPS evidence and 5-minute unacknowledged escalation
- Staff and Responsible workplace-overview status
- Admin/Responsible operational dashboard with canonical current-workplace tracking, live understaffing, late/no-show, shift-overrun, missing-checkout and long-break detection, Responsible shift handovers with material snapshots, time corrections, audit and Excel export
- IndexedDB operation/upload queues plus an offline operational shell
- Installed PWA behavior on Windows, Android and iOS
- Web Push notifications with per-device opt-in and automatic subscription renewal

## Environment

Use only the variables in [`.env.example`](.env.example). Public Supabase values may be exposed to the browser; server secrets must never use a `NEXT_PUBLIC_` prefix.

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=https://YOUR_PRODUCTION_HOST
GEOAPIFY_API_KEY=YOUR_GEOAPIFY_KEY
```

The Cloudflare app does not need a Supabase service-role key. The Web Push Supabase Edge Function uses Supabase's built-in server-side service-role environment internally; that credential is never exposed to the browser, Worker bundle or repository.

## Local / CI checks

```sh
npm ci
npm audit --audit-level=high
npm run lint
npm run typecheck
npm test
npm run build
npm run build:cloudflare
npx wrangler deploy --dry-run
```

Database regression suites are in `tests/sql/`. They use synthetic fixtures and roll back their transactions.

## Database

The production project is tracked through 161 ordered SQL migration files in `supabase/migrations/`. Historical StaffPortal migrations are retained because they are part of migration history, not because the old modules are active.

Do not reset or blindly replay migrations against production. A complete from-zero replay belongs on an isolated Supabase project.

## Important documents

- [Implementation status](UPTILLDAWN_IMPLEMENTATION_STATUS.md)
- [Build status](UPTILLDAWN_BUILD_STATUS.md)
- [Deployment](DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Legacy removal record](LEGACY_REMOVAL.md)
