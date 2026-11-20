# UpTillDawn Crew — build and release status

`main` is the canonical application branch. Historical build numbers and commits in Git history are not proof that the current commit has passed.

## Approved GitHub Actions workflows

Only these five workflows are maintained:

1. **Cleanup** — scheduled GitHub Actions history retention.
2. **CI production** — full application validation, available for manual dispatch, pull requests, and reusable workflow calls.
3. **Deploy production** — manually initiated production deployment, gated on successful full CI for the exact commit.
4. **CI main** — fast lint, typecheck, unit tests, dependency audit and the five-workflow inventory guard on changes to `main` and pull requests.
5. **Deploy main** — main-test deployment triggered by completion of **CI main**; its own deployment conditions determine whether it proceeds.

Do not add a sixth GitHub Actions workflow. Extend an existing one and update its validation when new automation is needed.

## Full validation scope

`CI production` includes production dependency audit, ESLint, TypeScript, Node regression tests, Next.js and Cloudflare builds, Wrangler dry-run, isolated Supabase migration replay, SQL regressions, generated database type checks and authenticated browser test suites.

A green fast `CI main` run does **not** replace full production CI or prove that all external services and live user journeys work.

## Release safety

Production deployment is not automatic merely because `CI main` succeeds. The manual `Deploy production` workflow checks the exact release commit against full CI. The separate main-test deployment is not a production release.

The old staging environment was retired in November 2026. Historical staging test evidence is retained in `docs/` but is not an active deployment gate.

For current results, inspect the actual run, job conclusions and logs in GitHub Actions. See `DEPLOYMENT.md` and `docs/RECOVERY_AND_RELEASE_GATE.md` for deployment and recovery details.
