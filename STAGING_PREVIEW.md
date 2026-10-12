# Isolated UpTillDawn test preview

This is a **separate Cloudflare Worker**: `uptilldawn-crew-staging`. It never deploys to the existing `uptilldawn-crew` Worker or `crew` alias.

## Test database isolation

The staging workflow is preconfigured with the **separate** Supabase test project `npbjrtiolqperdgljnhi` and its browser-safe publishable key. GitHub Actions variables `UPT_TEST_SUPABASE_URL` and `UPT_TEST_SUPABASE_ANON_KEY` may optionally override the defaults, but connecting to the production database is strictly rejected. Never use service-role credentials.

The branch must contain a `STAGING_PREVIEW_READY` marker **only after all 298 migrations have been applied and verified**. Until then, deployment is safely skipped. This marker has deliberately NOT been created yet.

The workflow explicitly rejects the existing production Supabase project `eakoavcieossazqzplke`. A test Supabase project needs the current SQL migrations and Auth redirect allowlist for the staging origin. No production data is copied automatically.

## Workflow

`.github/workflows/staging-preview.yml` runs on changes to `rebuild/interactive-role-training` and supports a manual dispatch. It installs pinned dependencies, validates code, builds Cloudflare assets, dry-runs deployment, deploys only the `wrangler.staging.jsonc` Worker, and checks the login and PWA URLs. Cloudflare API credentials are read only from existing repository Actions secrets.

The expected hostname format is `https://uptilldawn-crew-staging.uptilldawn.workers.dev` but **do not share it as a working link until the staging deployment succeeds and the URL is verified**.

Never run production database reset scripts or production deployment workflows for this preview. Keep PR #19 as draft until production acceptances are complete.
