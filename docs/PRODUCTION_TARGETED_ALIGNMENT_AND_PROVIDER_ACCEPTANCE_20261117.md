# Main → Production: targeted schema alignment and external-provider acceptance
Date: 2026-11-17 · Status: **Production database RPCs repaired; Worker release still pending**

## 0. Production repair outcome — current status (2026-11-17)

- The exact two-RPC patch in `supabase/upgrades/production-role-administration-alignment-20261117.sql` was successfully **COMMITTED to Production Supabase** `eakoavcieossazqzplke`. No table data, user profiles, external integrations, migration-history rows or Cloudflare Worker were modified by that patch.
- Before execution, the same full patch and the verified function-scoped rollback `supabase/upgrades/production-role-administration-rollback-20261117.sql` were exercised together in a single **ROLLBACK** transaction against the actual Production database. The rollback restored the original function MD5 and absence of the new draft RPC while never persisting the test.
- After the real commit: **12/12 required preflight checks PASS**, `anon` has no `EXECUTE` privilege on either RPC, `authenticated` does, and Supabase Health Advisor reported 0 lints.
- **No full production database dump or point-in-time backup was confirmed**. Supabase organization is on the Free plan. The committed change has a verified **function-scoped** rollback, not a replacement for full data recovery. Preserve that distinction in all release notes.
- Production Worker currently remains on **`0334a0f8e576d169d3b860a0fa53e03963798b7f`**, while Main contains the release candidate and must still pass the manually triggered **full CI production** against the exact final SHA. That workflow dispatches Production deploy after successful validation.
- Github release automation can only be manually dispatched through Actions; no `workflow_dispatch` ability is exposed by the installed GitHub connector. Also verify that the legacy Cloudflare Workers Builds `Production main` auto-build is not active; that external trigger was not available for inspection.
- Vendor test credentials remain entirely end-user-managed; no external provider transaction has been performed by the Maker.

The analysis below describes the **historic before-patch state**, not the current Production DB.

## 1. Evidence collected from the actual databases

- Release branch based on Main `e401f83cd678bcb3dee57227b2ac3217e537e488`.
- Main-test Supabase: `npbjrtiolqperdgljnhi`; Production: `eakoavcieossazqzplke`. No retired staging Worker exists; the test DB's historical project display name does not create a new staging environment.
- `scripts/production-preflight-readonly.sql`: **Main 12/12 required checks pass**; **Production 6/12 pass**. The six failures arise from exactly **two root causes**:
  1. Production lacks `public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)`. Therefore three event-draft existence, authorization and anonymous-denial checks fail.
  2. Production's `public.upt_current_effective_role()` is the old `select public.upt_effective_role(auth.uid());`. Therefore the Maker/Owner separation, role-mode selection and unauthenticated guard checks fail.
- `public.upt_set_admin_role_mode(text)` differs only in formatting between the two databases. Its actual role restriction, persistence and auditing behavior is equivalent; **do not replace it**.
- Production's last recorded migration version is `20261112062000`; Main's is `20261112220202`. This alone is not an error: historical alignment migrations differ.
- The **actual production prerequisite DO block** was executed in a `BEGIN ... ROLLBACK` transaction and passed. It checked existing function-body MD5s, required columns, grants and dependency objects. **No Production data or schema was changed.**
- Both replacement function bodies were compiled against the Main DB as uniquely named, temporary-in-transaction functions, followed by `ROLLBACK`. A subsequent metadata query confirmed that **neither temporary function exists**. This tests SQL compilation, not full Production behavior under every role.
- The Supabase security review notes that PostgreSQL grants `EXECUTE` to PUBLIC by default. The prepared script revokes PUBLIC and anon execution explicitly on both SECURITY DEFINER RPCs and grants authenticated only. Both RPCs also validate the actual signed-in identity and appropriate access logic.

## 2. Prepared, guarded correction

File: `supabase/upgrades/production-role-administration-alignment-20261117.sql`.

- **Not placed in** `supabase/migrations/`: no automatic Main migration replay or production rollout.
- Requires an exact verified pre-state: Production migration baseline, the old effective-role function's MD5, the existing Owner/Admin check functions' MD5s, absence of the new draft RPC, required columns and existing ACL.
- A single atomic transaction with a five-second lock timeout and 30-second statement timeout.
- Installs exactly the two Main-equivalent RPC definitions. It does **not** modify user profiles, approval data, head-admin assignments, role-setting RPC, finance/payment data, cron schedules, bank connections or any historical migration row.
- Rechecks both function privileges and Maker semantics before COMMIT; refreshes the PostgREST schema cache.

**Release sequence — only after separate explicit production authorization:**

1. Check the latest Production commit, production-worker routing and active Cloudflare Workers Builds triggers. The separate Cloudflare dashboard could still have a legacy `Production main` auto-build; **verify and disable unintended direct auto-publish from main before continuing**. GitHub workflows alone cannot prove its absence.
2. Verify a restorable Production backup, the current schema/ACL hashes and the on-call recovery plan. A full restore-to-new-project proof may incur cost: do not create a chargeable project without approval.
3. Run `scripts/production-preflight-readonly.sql` and the three dependency checks again, record results; the expected pre-patch result is a controlled blocker.
4. Apply only the reviewed upgrade file to the **verified Production Supabase project**, as one transaction. Stop if the MD5/baseline precheck rejects it. Do not weaken checks to force a green result.
5. Re-run `scripts/production-preflight-readonly.sql`: **12/12 required PASS**. Revalidate callable RPC metadata, anon-denial, authenticated Admin/Administration and Owner role E2E, timesheet and finance gates, and logs. Record a release audit/PR reference rather than forging migration history.
6. Obtain explicit release authorization; run **CI production** against the exact release SHA, then **Deploy production** only if full CI and all blockers pass. Verify real Production logins, Owner role persistence, draft creation, contract pages, financial routes and worker errors immediately afterwards.
7. If any required check fails, block publication. Preserve the old Worker; favor a forward corrective patch over unreviewed reversions. A database-function rollback must use a separately reviewed previously captured definition and authorization, never a reset of user data.

**Limit:** This patch does not magically demonstrate a fully deployed Production application; it merely makes the two proven schema contracts deployable under the release gate.

## 3. External provider acceptance status

The metadata-only live count of `upt_private.integration_connections` on both Main and Production returned **zero app-managed provider records**. This says nothing about possible older Cloudflare secret bindings; do not declare a provider connected or disconnected solely from legacy environment variables.

| Provider / feature | Existing app workflow | Unverified requirement | No-credentials safe behavior |
|---|---|---|---|
| EventPay Belgium RFID/QR cashless | Admin Sales + Administration Bank & payments; import and settlement reports | Official authorized test environment, card/wallet mapping, terminal/checkout/top-up/refund contract, provider-confirmed result, idempotency and inventory accounting | Use official EventPay POS for card top-ups and Bar/Merch payments; **never locally synthesize balances or payment success** |
| Weeztix entrance scan | Administration Ticketing and the Inkom scanner | Linked test event, authorized OAuth, valid/used/invalid QR and cross-event replay handling, physical mobile camera | Do not grant entrance without provider confirmation; official scanner remains fallback |
| SumUp | Admin Sales + Administration Bank & payments, one shared encrypted credential store | Approved sandbox merchant and read-only probe, event settlement mapping, refunds/duplicates | No checkout, charge, or settlement synchronization |
| Documenso | Administration Contracts | Test account, allowed cloud origin, API token, unsigned/signed/declined scenarios, webhook integrity, immutable archive | Draft contracts only; no dispatch declared successful |
| Billit / Peppol | Administration Invoices | Sandbox party, account verification, EN16931 payload and end-to-end submission/receipt | Local invoice/UBL preparation; no claimed Peppol delivery |
| Banking / Ponto | Administration Bank & payments | PSD2 account consent, read-only imported statements, stable transaction IDs, reconciliation and expired authorization | Existing file/CSV statement import; never hold bank login details |

**Connection-test conditions:** the already implemented read-only probes must reject missing/malformed credentials, same-origin violations, unapproved users and revoked roles. A returned `connected` means *credentials or read-only bank-account access only* and does not certify signatures, payments or legal delivery.

**External actions still required:** an authorized business administrator must obtain and save the above provider sandbox credentials **inside their owning UpTillDawn modules**, then perform test transactions with the vendor. The Maker cannot fabricate those third-party authorizations; never transmit account secrets in chat, repository code or QA artifacts.

## 4. Strict completion boundaries

- Production DB RPC alignment: **COMMITTED and checked 12/12 PASS** on 2026-11-17; function-scoped restoration rehearsed in a rolled-back transaction.
- Production full CI/deploy: **NOT STARTED**; no change to triggers; exact release commit requires manual workflow_dispatch.
- Main fast CI is green on pre-release commits; run fast CI and Main deploy on the final release candidate SHA.
- Targeted RPC alignment SQL: applied and postchecked; authenticated post-patch role/event E2E still needs the Production acceptance stage.
- Vendor acceptance: **BLOCKED ON AUTHORIZED THIRD-PARTY TEST ACCESS**, not a software test PASS.
