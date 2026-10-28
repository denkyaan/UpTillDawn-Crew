# UpTillDawn Administration — end-to-end acceptance contract

Status: **implementation in progress**. This document is not evidence that a feature is implemented.

## Role and portal boundaries
- Administration and Admin share one finance data source; administrative employees can create/edit drafts and propose schedules, but only Admin may finally approve, void, or permanently delete.
- Server actions, RPCs, storage and RLS must enforce permissions independently of UI.
- One user may have several roles; deny access when approval is revoked.
- No maker-only or AI error console in the administrative employee portal.

## Administration navigation and data
1. Overview: revenue, costs, gross margin, paid, unpaid, overdue, awaiting approval, upcoming obligations; date/event/counterparty filters and drilldowns.
2. Incoming documents: PDF, image, invoice, order form, receipt, bank statement, credit note, quotation. Upload with validation, private storage, malware quarantine, audit trail, deduplication and immutable original.
3. Extraction: background OCR/parser with confidence and review queue; never treat extracted data as approved. Preserve original, provenance, VAT breakdown, vendor, document number, due date and currency.
4. Counterparties: customer/supplier register, VAT/enterprise IDs, address, contact, payment details, Peppol endpoint validation.
5. Finance: purchase/sales invoices, line items, tax rates, totals, draft/review/approval/issue/payment/void transitions, credit notes and linked orders.
6. Payments: bank imports with deduplication and reconciliation proposals; paid/partial/overdue statuses, reminders, outstanding amounts. Never automatically transfer funds.
7. Accounting: export journal entries and attachments; adapter architecture for an explicitly selected accounting vendor; idempotent sync, retry, reconciliation, audit.
8. Peppol: Belgian e-invoicing readiness, structured XML validation, accredited access-point adapter, endpoint discovery, inbound/outbound tracking. No fake transmission.
9. Workforce: build shift schedules across events and workplaces, detect overlaps, availability conflicts, legal/rest issues, submit to Admin, approve/reject with reason, publish and notify.
10. Admin task hub: event-independent tasks, owners, due dates, priorities, attachments, approval and notifications.
11. Reports: revenue/cost by event, VAT, accounts receivable/payable, cashflow, exports, activity/audit logs.

## Cross-portal integrations
- Events/workplaces/shifts provide authoritative IDs; schedule approval publishes only after Admin approval.
- Sales, inventory, merch, tokens, purchasing, and guestlist feed relevant accounting events through an auditable ledger mapping; no double counting.
- Notifications target the right role with explicit permissions; avoid leaking financial information into chat.
- File uploads use private buckets, content-type/size limits, asynchronous malware scanning, safe download URLs and retention policy.
- AI assistance may suggest extraction/categorization but cannot finalize invoices, payments, or legal submissions.

## Localization and accessibility
- NL, FR, EN and DE for every visible label, validation, empty state, notification, date and currency.
- Default to device language, allow manual override, persist preference.
- Mobile-first, accessible keyboard controls, high-contrast error pages, no dead links.

## Required CI and E2E gates
- Fresh local Supabase migration replay, generated types parity, RLS tests with staff/responsible/administrative/admin accounts.
- Draft/create/update/review/approve/void permissions; deny privilege escalation.
- Upload/scan/extract/review/reject duplicate and malicious files.
- Partial payments, VAT arithmetic, rounding, credit notes, overdue, reconciliation.
- Schedule creation/overlap/review/approve/publish notifications.
- Four-locale navigation, iPhone-sized viewport, route existence, error states.
- Real staging deployment smoke test with seeded non-sensitive test accounts and cleanup.
- Never merge to production solely because build succeeds.

## Delivery rule
Complete implementation, connected services and verified E2E results are required before calling this project finished. External Peppol/accounting providers require real credentials and contracts; until then label integrations as unconnected.
