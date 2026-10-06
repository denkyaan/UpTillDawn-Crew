# UpTillDawn Crew build status

`main` is the canonical production branch.

## Release gate

The CI release gate runs the full validation chain on one hosted runner to avoid multi-runner queue fragmentation:

- production dependency audit;
- ESLint;
- TypeScript;
- Node regression suite;
- Next.js production build;
- Cloudflare Worker build;
- Wrangler deployment dry-run;
- isolated local Supabase startup;
- replay of all repository migrations from zero;
- every SQL regression suite;
- generated public database type parity;
- 15 authenticated browser bots and persistence checks.

A successful CI run triggers the Cloudflare production workflow, which repeats critical static/build checks, validates production Supabase RPC contracts, deploys the Worker + public alias and performs public HTTP/manifest/service-worker smoke checks.

Last fully verified release before the first-use cleanup: CI #2811 and Deploy Cloudflare #1034 on commit `e35ccff73570b7db0650c15341c4b3fc41f43dfc`.

See `UPTILLDAWN_IMPLEMENTATION_STATUS.md`, `docs/FIRST_USE.md` and `DEPLOYMENT.md`.
