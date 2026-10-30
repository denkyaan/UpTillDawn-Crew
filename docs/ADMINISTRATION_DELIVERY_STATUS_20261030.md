# Administration and portal completion — 30 October 2026

## Implemented
- Transactional, authorized CSV ticket ingestion with immutable import receipts, repeat-import detection and conflict rollback; persisted revenue summaries.
- Payroll CSV export of approved/locked, closed time records with explicit recorded-break columns and no wage inference.
- Admin-only, idempotent inventory receipt against approved event-linked purchase invoice quantities, stock movements and audit.
- Editable operational cases for permits, logistics and tasks; submit, independent Admin review, completion, audit and scheduled deadline notifications with deduplication and retry.
- Complete invoice/payment/approved-credit snapshots for finance totals and individual balances, including credit-adjusted paid/void actions.
- Repair input validation for dates, emails and spaced bank identifiers. Correct contract archive regex escaping and final Admin approval boundaries.
- Restore staging installations missing the original booking/contract and promotion schemas. Recovery migrations skip original schema creation on clean replays.
- Preserve offline SEPA CSV/JSON preparation and XML export; localize labels and validation feedback.

## Evidence
- Node regression suite: 756/756 passed, including the final SEPA adjustment.
- Next production build passed; final source compile required after any subsequent changes.
- Production dependency audit: zero vulnerabilities.
- Staging database migrations applied and schema presence checked.
- Seven direct authenticated staging RPC workflow checks passed. A rolled-back SQL integration verified 5,400 net payroll seconds, staff denial and deadline deduplication (zero repeat deliveries). Full browser CI remains a separate required gate.
- Local browser execution is blocked by the execution environment. No browser result is inferred from compilation or Node tests.

## Still open
This project is not declared fully finished. Real bank connectivity, provider-specific bank acceptance, Peppol delivery, accounting-provider sync, signature distribution/archival with a configured signing service, automatic OCR/extraction and promotion screenshot verification still require working service connections and verified flows. The current signing dispatch gate remains disabled. Email drafts are not automatic delivery.

## Deployment boundary
Staging changes are authorized. Complete application CI is deliberately triggered by the release checkpoint file, not every staging push. Production release requires full acceptance evidence.

## Additional verified evidence
- Eight authenticated native HTTP/form workflow checks passed against the application and staging database, including four-locale rendering and promotion routes.
- The first full CI found the promotion-chat sender FK index missing. The index and staging legacy-index parity are repaired; the complete public FK index check now passes. Full CI is rerun on the corrected candidate.
- Documenso Community Edition self-hosting is the established free-service choice. Bank and accounting vendors have not been specified. Peppol preparation, external service wiring and automated document/evidence verification must still be completed and verified.
