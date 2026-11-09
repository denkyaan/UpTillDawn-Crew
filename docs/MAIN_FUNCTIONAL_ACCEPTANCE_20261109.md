# UpTillDawn Main — Functional Acceptance (2026-11-09)

**Environment:** GitHub main and isolated Supabase main-test `npbjrtiolqperdgljnhi`. **Production unchanged.**

## Executed and verified

- Main CI (lint, TypeScript, 383 JavaScript test files, dependency audit) and Cloudflare deployment smoke checks were green for main `83dcb246` before this repair.
- Thirty isolated SQL acceptance checks on main-test completed without errors. They covered 15-bot event roles/shifts/availability, future event role visibility, QR attendance, timesheet submission/rejection/reapproval/lock, chat, promotion task/evidence lifecycle, offline uploads, session revocation, responsible workplace access, portal roles and approvals, God Mode, permission/privilege/RLS boundaries, roster approvals, operational obligations, finance malware quarantine/path/hash and an Admin finance credit-adjusted settlement scenario.
- Two concrete regressions were detected and resolved: the Storage test had not modeled the new pending-to-clean antivirus quarantine, and `admin_provider_bank_settlements.approved_by` was missing a covering index.
- A rollback-based test now proves pending operational media is invisible even to its owner and Responsible. A synthetic clean verdict then allows the appropriately authorized readers, while unrelated/unapproved users remain denied.
- `tests/sql/foreign-key-indexes.sql` passed after the index was applied. The isolated Admin finance lifecycle was also executed successfully with a synthetic Admin account.

**Synthetic data only:** All fixture transactions ended in ROLLBACK; no permanent QA users, events, uploads or invoices remained.

## Not yet accepted

1. Five-role **authenticated graphical browser** acceptance (Admin, Administration, Responsible, Staff and Promotion), including every page, button, form, navigation/subtab and four-locale mobile layout. Existing browser scripts require a locally running Next app, seeded disposable QA accounts and session bridge; the fast CI does not run them.
2. Native GPS, check-in camera/QR, push notifications, iOS/Android PWA, true network-offline and concurrency acceptance.
3. Real Cloudmersive clean/infected sample scan — waived by user. Existing SQL confirms policy behavior only, not provider detection.
4. Eventix, SumUp, Weeztix, Peppol and third-party accounting contract/provider production E2E validation.
5. Protected production release validation and deployment (requires explicit user authorization).

**Release decision:** main-test code/data assertions are substantially verified; **full functional acceptance remains open**, chiefly for authenticated browsers, real-device flows and external integrations. Do not label the app finished based on unit tests or green CI alone.

## Additional isolated Administration acceptance (2026-11-09)

- One disposable Head Admin, two delegated hands (one acting as Administration) and ordinary Staff completed the real database integration test with full rollback.
- Payroll snapshot reported **5,400 net seconds**; ordinary staff access was denied.
- Linkerhand and Rechterhand could not approve the dossier. The Head Admin approved their own submitted dossier and completed it. The two deputies could not modify leadership assignments.
- Deadline notification processing produced three recipients in this fixture and **zero duplicate deliveries** on replay.
- A separate disposable staff user was denied direct creation of both Finance counterparties and financial documents.
- The repeatable SQL suites are `tests/sql/administration-workflow-isolated-e2e.sql` and `tests/sql/administration-finance-isolated-rls.sql`. These are database-level acceptance, not real browser/device acceptance.

## Management model — exactly one Head Admin + two deputies

- The **Head Admin** is the only permanent Admin after the role has been explicitly claimed from Admin Management. The Head may approve and reject their own submitted cases; no second approver is required.
- **Left hand** and **Right hand** are separately assigned, uniquely occupied slots for approved accounts. Both receive the existing Administration portal entitlement for preparation and daily management, **not** the permanent Admin role or final approval privileges. Other operational/event permissions still follow their original event role assignments.
- The database prevents second Admin promotions, duplicate leadership assignments, accidental Head deactivation and deputy self-escalation. Head transfer and deputy reassignment are audited. A leadership-managed Administration grant is revoked when that deputy is replaced; independently existing Administration grants are preserved.
- To avoid choosing between the current two approved Admin accounts without instruction, **no Head is auto-assigned by the migration**. The intended Admin uses **Admin → Central management → Leadership** to claim the Head position; that explicit action demotes other Admin-role profiles to Staff while preserving their data. The Head then selects Left and Right hands.
- The user clarified that a second independent Admin is **not** needed for final case review. Earlier claims about creator self-approval being forbidden are superseded by this decision.
