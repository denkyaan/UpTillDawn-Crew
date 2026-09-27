# Uptilldawn implementation status

## Current production baseline

Uptilldawn is deployed from `main` to the Cloudflare Worker at `https://crew.uptilldawn.workers.dev`, using Supabase project `eakoavcieossazqzplke`.

The current desktop/web view and installed mobile PWA view are the canonical defaults. The live `role_ui_rules` rows have been checked against `ROLE_UI_DEFAULTS` in `lib/role-ui.ts` and match the repository baseline.

### Canonical mobile quick tabs

- Staff, assigned event: Evenementen, Briefing, Mijn shift's, Werkplekken.
- Staff, active shift: Mijn werkuren, Mijn shift's, Briefing, Taken.
- Responsible, assigned event: Evenementen, Briefing, Shift's, Werkplekken.
- Responsible, active shift: Mijn werkuren, Shift's, Werkplekken, Help.
- Mobile navigation shows a compact set with an up/down expand control rather than horizontal swipe.
- Responsible overview shows own-workplace personnel name/status plus live work/pause timers.
- Staff overview shows own-workplace personnel name/status without timers.
- Admin Workplace management can promote staff to Responsible and return a Responsible to Staff while preserving other valid Responsible assignments.

### PWA / notifications

- Service worker is registered with update checks and privacy-safe offline fallbacks.
- Installed PWA refresh checks run on registration, focus, visibility return, online return and push; Periodic Background Sync is registered where the platform supports it.
- Web Push subscriptions are per authenticated user/device and require user permission.
- New `crew_notifications` rows enqueue delivery through `pg_net` to the `push-notification` Supabase Edge Function; the dispatch timeout is 10 seconds to tolerate cold starts without false timeout records.
- VAPID private material and webhook secret are kept outside the public repository.
- Invalid/expired push subscriptions are cleaned automatically on 404/410 delivery responses; registration, database RPC and delivery reject non-HTTPS and literal IPv4/IPv6 push targets, including IPv4-mapped IPv6 forms.
- Push notification links are restricted to local app paths; protocol-relative escape paths are rejected.
- Private Storage writes require an approved account in addition to user-owned folder scoping.
- Notification clicks open the linked in-app destination.

God Mode credentials and sessions are stored only in private server-side state. Configuration status and credential changes are guarded by the immutable app-owner check; browser roles cannot read the underlying private tables.

## Verified application areas

- Auth, approval, role switching and immutable maker/admin protection.
- Event, workplace, shift, Staff accept/decline, audited reassignment, two-party replacement/swap requests, open-shift claims, revision-aware 24h/2h/15m pre-shift reminders and Responsible assignment workflows.
- Check-in/out and audited work/break timing.
- Briefings, personal instructions, tasks, workplace operational checklists with required/photo-required items, workplace material inventory with audited issue/return/damage/missing handling and manager-approved Staff settlement requests, event emergency information with offline caching, scoped event/workplace document library with offline-critical files, help/incidents with current-workplace binding and scheduled unacknowledged escalation, and workplace-scoped chat.
- Private media storage and signed/scoped reads.
- Responsible/Staff/Admin role-specific dashboards, including canonical current-workplace status, live understaffing, late/no-show, shift-overrun, missing-checkout and long-break detection, plus auditable Responsible shift handovers with captured inventory state.
- Offline operation/upload queues and operational offline shell.
- Admin time corrections, audit and Excel export.
- Device-language synchronization.
- Cloudflare Workers AI maker-only Edit mode assistant.
- Cloudflare production deployment and Supabase push Edge Function.
- Realtime operational refresh, Admin System Health observability, and Admin Release Readiness with schema-drift detection, required sync blockers and operational deploy warnings.
- Repository CI includes an isolated local Supabase fresh-install job that resets from zero, replays every migration, executes every SQL regression suite, and compares normalized freshly generated public database types against `types/crew-database.ts`. GitHub Actions run `36336833839` passed this gate for commit `1002b85ee1446294f62d2f84d1f7a685a54fdb01`: 166 migrations, 16 SQL suites and exact normalized public-type parity.

## Cleanup / regression verification

The current cleanup now contains 16 SQL regression files in `tests/sql/`. The isolated fresh-install CI run `36336833839` replayed all 166 migrations from zero and passed all 16 suites before passing normalized generated public-type verification. During that run, several tests were found to encode obsolete product behavior and were corrected to the current baseline:

- Responsible scope is workplace-assignment based rather than broad event-wide workplace access.
- Staff may see their assigned future workplace/shift according to current role UI rules.
- Responsible cannot create workplaces or pre-shift tasks.
- Legacy private-chat assumptions were replaced by current workplace-chat behavior; the remaining private-chat peer RPC and direct `chat_members` read grant were revoked.
- Incident/media Responsible fixtures now include the active-shift context required by current rules.

The corrected SQL suites pass, including privilege/RLS, SECURITY DEFINER surface, release access, profile-role integrity, foreign-key coverage, Responsible read scope, operational security, chat lifecycle, queued uploads, storage security, offline time dependencies and event-selection guards. A historical migration-history drift was also repaired: the Geoapify distributed rate limit, attendance-request concurrency guard and task-status revocation guard are now applied and recorded with their original repository versions.

Repository CI is the release gate for lint, TypeScript, Node tests, production builds, Cloudflare Worker build and Wrangler deployment dry-run. CI run #790 for commit `c082b394600a4cbc4030de6fd35389016addc9af` passed every gate after the health-dashboard render-purity correction.

## Full option/function audit

A full option/function audit was run against the current production baseline. Coverage included all role views, auth portals, event/workplace/shift flows, work and break timing, task/instruction acknowledgement, chat/media, incidents/help, profile/settings, notifications, export/audit, offline sync, PWA/Web Push, Edit mode and server API routes.

The audit also checked the database attack surface rather than only the visible UI:
- the current regression inventory contains 16 SQL suites; the isolated fresh-install CI run passes all 16, while production rollback-fixture audits remain a separate runtime verification step;
- every public application table has RLS enabled;
- anonymous table CRUD grants are absent;
- anonymous table access is absent; anonymous RPC access is limited to the explicit token-gated God Mode surface; the former info-admin bootstrap RPC is closed and revoked from browser roles;
- retired private-chat creation/peer discovery remains revoked;
- generated Supabase TypeScript types exactly match the production schema;
- the repository now contains 166 migrations through `20260927160000_retire_legacy_staffportal_schema.sql`; CI proves all 166 replay from zero. Production migration parity must be rechecked after deployment of the branch before claiming an exact production count.

Issues found and corrected during this audit:
- permanent-admin server routes now use the central admin privilege check;
- initial language selection follows the device/browser language until the user explicitly chooses another language;
- Admin login through Personnel/Responsible selects the matching visible role mode;
- Push subscriptions are removed on logout/auth loss; unsafe literal hosts are blocked independently in the app route, database RPC and Edge delivery;
- notification links cannot escape the app origin;
- private Storage writes require approved-account/user-folder scope;
- Responsible/Staff preview data is restricted to the effective role for chat, operations, shifts, tasks, workplaces, incidents, badges, events and overview;
- Edit-mode code is no longer in source and database writes require a temporary verified unlock with failed-attempt rate limiting;
- AI Edit-assistant POSTs reject cross-site origins;
- QR attendance is the only supported start/stop entry path: direct clock RPCs and the retired pre-QR check-in/check-out RPCs are revoked, while old offline direct-clock queue items are quarantined instead of replayed.
- authenticated users retain read-only access to `role_ui_rules`; direct table mutation privileges are removed and God Mode changes flow only through the token-validated RPC.
- the obsolete `edit@uptilldown` shortcut was removed from normal admin login; God Mode uses only its dedicated login route.
- the legacy `info@uptilldawn.be` bootstrap was fully retired: the audit found and removed the remaining e-mail-confirmation auto-promotion trigger, status/password helper RPCs and private marker table.

## Supabase advisor state

Known remaining advisor findings are reviewed rather than blindly removed:

- `admin_role_modes`, `push_subscriptions` and private owner/God Mode state use restricted access intentionally; browser table grants are not the access path.
- Authenticated SECURITY DEFINER RPC warnings correspond to explicit application RPC boundaries and remain covered by the security regression suite.
- `pg_net` is reported as installed in `public`; the installed extension is non-relocatable and creates/uses its own `net` schema.
- Leaked-password protection remains a Supabase Auth project setting to enable.
- Performance advisor findings are unused-index informational notices; foreign-key index coverage passes.

## Remaining external / non-repository gates

These are not regressions in the current web/mobile baseline:

1. **Temporarily deferred by the product owner:** enable Supabase leaked-password protection in the hosted Auth project setting. Security Advisor still reports `auth_leaked_password_protection` as disabled; this cannot be represented by SQL migration state.
2. **Temporarily deferred by the product owner:** complete the remote backup -> restore disaster-recovery proof. A separate healthy Supabase project exists, but a true physical backup restore must still be initiated through Supabase Restore to a New Project before it counts as DR proof.

## Additional hardening now completed

- Critical offline browsing/snapshot coverage is implemented for operational data, emergency information and offline-critical event/workplace documents; write queues remain idempotent and authorization is rechecked on replay.
- Cross-device/PWA contract tests run in CI for installed/offline behavior across the supported browser/device model; physical device checks remain a release practice after major OS/browser updates rather than an unimplemented feature.
- Observability now combines System Health, service-level/freshness alerts, operational alerts, Release Readiness and production log review.
- Worktime governance now has a versioned Belgian operational overtime baseline with configurable daily/weekly thresholds and break exclusion. It remains intentionally non-payroll-authoritative until employer/pay-period payroll rules are supplied.

The current web/mobile/PWA layout and behavior should be treated as default unless a future change is explicitly requested.
