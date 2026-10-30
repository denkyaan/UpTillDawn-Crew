# Administration delivery status — 30 October 2026

The application is not fully finished. Navigation fixes are live in production; the administration completion and Peppol work below is deployed to staging.

## Production

- Administration subtabs use native document navigation and retain their portal routes. Login clears stale cross-portal return targets. Shared notifications, profile, personnel, timesheets and sales links retain their Administration context.
- Authenticated navigation checks cover Admin and administrative employee on mobile and desktop, real login, stale personnel return targets and ordinary-staff denial. This is automated browser evidence; the user’s own iPhone has not been independently retested.
- Production source: `b05b3ccc5be6c9479546856694114a735942e64b`. [Navigation checks](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/41113148306) and [production deployment](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/41114629434) passed.

## Implemented on staging

- Transactional CSV ticket ingestion with authorization, immutable import receipts, repeat detection, conflict rollback and persisted revenue. Same-origin validation checks the public request host rather than an internal Next.js URL.
- Payroll CSV export of approved/locked, closed time records with recorded breaks. Wages are not inferred from hours.
- Admin-only, idempotent inventory receipts against approved, event-linked purchase invoice quantities, with stock movements and audit records.
- Operational cases for permits, logistics and tasks: submit, Admin review, completion, audit and scheduled, deduplicated deadline notifications.
- Complete finance invoice/payment/approved-credit snapshots and reconciled paid/void actions. Existing financial CSV and SEPA CSV/JSON/XML exports remain available.
- Peppol preparation for the single Belgian organization: editable company profile, Admin approval, automatic invalidation after changes, audit, customer identifiers, invoice references and VAT/unit fields. Approved sales invoices and linked credit notes can download UBL XML; actual recorded payments reduce the payable amount. Export does not mark a document as sent or execute a payment.
- Four-language interface and validation feedback (NL, FR, EN, DE).

## Verified evidence

- Local Node suite: 792/792 passed. TypeScript, lint and Next production build passed; two pre-existing lint warnings remain.
- [Focused Administration run](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/41130622432) passed: eight authenticated HTTP/form checks, ten real browser workflow checks, Peppol company and invoice approval, mobile XML downloads, payment totals, access boundaries and approval invalidation. Checks use disposable local Supabase data.
- Generated examples and actual browser downloads pass UBL 2.1 XSD, CEN EN16931 and Peppol BIS Billing 3.0.21 checks. Three deliberately invalid controls are rejected. This verifies XML preparation; recipient registration and network delivery are not connected.
- [Staging deployment](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/41130622430) passed for source `50cb5a83a9e7ba5fca8a0ce1f7e47c5a56e313fd`. Database baseline: `20261030205235`.
- Staging SQL verified exact VAT rounding, company approval/invalidation, audit and staff denial, then rolled back. Temporary QA rows were confirmed absent. No real company profile has been entered.
- An older manual workflow attempted account-dependent SQL before seeding its accounts. Its ordering is repaired; all four Administration SQL suites also run after role seeding in the focused workflow. This orchestration fix does not establish that the entire legacy workflow has passed again.

## Remaining application work

- Real bank connectivity, bank-specific acceptance and accounting synchronization. The user has no accounting package yet; no provider has been chosen or connected.
- Peppol access-point configuration, recipient discovery and actual delivery.
- A deployed Documenso Community Edition service, its PDF/signing/archive integration and verified live operation. Contract sending is still disabled in source.
- Automatic invoice extraction/OCR and document-to-inventory processing.
- Automatic promotion evidence verification and full strike/suspension acceptance.
- Complete application acceptance, production schema migration and release of the remaining staging work.

The complete application CI is requested through the release checkpoint at the release-candidate boundary. Fast and focused checks validate routine staging changes. No production release of these remaining modules is claimed.
