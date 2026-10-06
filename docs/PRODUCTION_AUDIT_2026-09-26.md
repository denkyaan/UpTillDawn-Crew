# Production audit — 2026-09-26

Final release audit baseline after the PWA, push, offline-sync, authorization and runtime-performance hardening pass.

## Database/query performance

- Removed periodic 30-second authorization/profile polling from `AuthProvider`; refreshes are event-driven.
- Removed 15-second `router.refresh()` polling from operations and Responsible live-personnel views.
- Digital work/pause clocks remain local one-second UI timers and do not generate database traffic.
- No remaining `setInterval` + `router.refresh` pattern was found in the default branch.
- No broad `.select("*")` query pattern was found in the default branch scan.

## Security and production edge cases

- God Mode page validates its private HTTP-only session token server-side before rendering.
- God Mode setup remains restricted to the immutable owner check.
- God Mode session cookie remains `httpOnly`, `secure`, `sameSite: strict`, path `/`, with a two-hour lifetime.
- God Mode setup login is aligned with the configured dedicated login `edit@uptilldawn`.
- No public service-role key/client pattern was found in the default branch scan.
- No leftover `console.log`, `console.debug`, `debugger`, `TODO`, `FIXME` or `HACK` marker was found in the default branch scan.

## Release gate

Repository CI remains authoritative for dependency audit, lint, TypeScript, tests, production Next.js build, Cloudflare Worker build and Wrangler deployment dry-run. The final audit commit must pass that complete gate before this baseline is treated as release-clean.
