# UpTillDawn — Main functional acceptance and production alignment

Audit date: 18 November 2026. These are **verified checks, not a production-ready certificate**. All database work in this audit was read-only or an explicit single-transaction `BEGIN … ROLLBACK` test on isolated Main. No production database writes or production CI/deploy were authorized.

## Verified Main

- Deployed Main commit `e35f5f31db9ff006c806430c31716f0e0fd0e2a5`: [full Main QA run](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/44314081051) completed **successfully**.
- Seven operational roles / 14 browser sessions: **134 passed, 0 failed** in the authenticated Main browser matrix; four UI languages and desktop/mobile viewports are represented in the harness.
- Thirty distinct QA users: **30 authenticated, 30 browser contexts, 30 Realtime subscriptions and deliveries; zero HTTP 5xx, zero failed assertions**. Every temporary account/event was cleaned.
- Main Cloudflare Worker post-deploy window: **640 successful requests and zero new resource-exceeded (1102) invocations**. Older failures in the rolling 90-minute aggregate are historical and not evidence of a current failure or unlimited future capacity.
- Live Main SQL, rolled back: seven real QA user identities' JWT-bound permissions match their roles. Head, Left hand, Right hand and Administration can manage administrative functions; Staff, Responsible and Promotion cannot.
- Live Main SQL, rolled back: Head/deputy workflow, 90 minutes of net payroll after break, Staff payroll denial, Head-only approval, deputies denied approval/leadership takeover, deadline reminder idempotence. No second Head was created.
- Live Main SQL, rolled back: invoice draft → review → approval, unpaid and overpayment rejection, partial payment plus credit-note settlement, paid status, and rejection of void after settlement. No real invoice/payment or outside delivery persists.
- Existing Main isolated functional E2E verifies Administration draft event persistence/editing, workposts, shifts, briefing visibility, Staff availability, timesheet rejection/resubmission/approval/lock, DJ booking, financial Staff denial and administrative UI reads. These checks do not mean external contract signing or live payment processing is verified.

## Production comparison — release BLOCKED

Read-only metadata queries (no real personnel/business row exports):

- Both environments expose **18 of 18 reviewed critical public tables**, with **192 of 192 reviewed column definitions matching** for type, nullability and defaults. This is a *limited* schema parity check, not full database equivalence.
- Main: latest migration `20261118121657`, 393 recorded migrations.
- Production: latest migration `20261112062000`, 412 recorded migrations. Histories are divergent; **do not blindly replay all Main migrations**.
- The enhanced `scripts/production-preflight-readonly.sql` has **22 checks** (21 required and 1 informational), and all required checks pass on Main.
- In Production **8 required checks fail**:
  1. `verified_self_scoped_session_context` — `public.upt_current_session_context()` is **missing**; the current Main authentication pipeline requires it.
  2. `chat_read_hotpaths_are_non_mutating` — the currently deployed chat summaries/typing RPCs do not match Main's STABLE read-only contracts.
  3. `approved_gate_rejects_blocked_accounts` — the approval helper's required blocked-account behavior differs.
  4. `task_read_and_manage_bind_actor_to_session` — required self-scoped task authorization logic is missing.
  5. `driver_supervisor_binds_actor_to_session` — caller identity binding differs.
  6. `responsible_binds_actor_to_session` — required Responsible actor-binding and approval guard differs.
  7. `successful_admin_login_audit_is_own_account_only` — the successful-login lockout ledger lacks the canonical verified-account restriction.
  8. `event_command_revenue_is_admin_only` — the Admin-only revenue redaction contract differs.
- The current Main migration tip is *not* expected in Production's divergent history; the optional migration-history check is informational, not an instruction to alter history.

**Production must remain unchanged** until the Head/Owner explicitly authorizes a carefully reviewed, idempotent production alignment plan. First capture a recovery-capable production backup and schema/function diff; stage only the necessary compatible definitions, verify references/permissions, run this preflight read-only again, conduct authorized full Production CI and rollback verification, and only then release. Passing a Main build, matching table columns, or a SQL contract test is insufficient to bypass this gate.

## Externally dependent integration status

The `upt_private.integration_connections` app-managed encrypted credential store contains **zero provider records in both Main and Production**. That does **not** prove no provider credentials exist in deployment environment variables or with third parties; environment secrets were not inspected.

- **EventPay:** contract/provider coordination required for the RFID/QR bar, merch and token payment flow; no validated charging/top-up API contract or live settlement test.
- **Documenso:** integration/configuration UI exists; live signing dispatch remains disabled pending approved credentials and signed callback acceptance.
- **Peppol (Billit):** document preparation exists; actual sandbox/live access point acceptance and delivery receipts are unverified.
- **Weeztix:** entrance QR scanner and an official-app/manual fallback exist; real active event configuration and server-confirmed admission remain unverified.
- **SumUp:** merchant credentials and read-only connection probes are supported; actual transaction and settlement acceptance is not verified.
- **Bank/Ponto:** setup, import and reconciliation workflows exist; provider OAuth/bank authorization and real statement settlement acceptance remain unverified.
- Local/default OCR does not require a Cloudmersive key; third-party Cloudmersive remains optional.

Credentials being present must never be displayed as "connected/live" until an actual authorized provider acceptance test succeeds. No real customers, bank transfers, ticket admissions, contract signatures or card charges were created by this audit.

## Acceptance boundary

The rollback-only DB tests do not replace user-driven form validation on real devices. Main Browser QA covers seven *operational* identities; Maker/God Mode, contractual signing with a real provider, real RFID hardware, camera behavior on an actual phone and external callbacks need separate user/provider-controlled acceptance. Production release is blocked independently by the eight required DB checks.
