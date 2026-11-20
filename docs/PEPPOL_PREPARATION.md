# Peppol preparation

This module prepares outgoing UBL Invoice 380 and CreditNote 381 documents for the single Belgian Up Till Dawn organization. It does not send messages, execute payments, change invoice approval, or mark a document as issued or sent. Access-point registration, recipient discovery and network delivery require a separate provider integration.

The organization profile is maintained in Administration → Management → Settings. Administrative employees may save it; only Admin may approve it. Changing business data clears that approval. Updates use an optimistic version check and append an audit record. Ordinary staff cannot read these tables or prepare exports.

Customer Peppol identifiers are entered on the financial counterparty form, including the scheme prefix, for example `0208:0123456749`. Outgoing documents have a Peppol section for customer/order references, delivery details, units, VAT categories and exemption reasons. These references may be enriched by Admin after approval; financial line data remains locked. Zero VAT is never guessed to mean exemption, reverse charge or zero rating.

Preparation checks identifiers, required fields, approvals, exact line/VAT-group rounding, currency, the original sales invoice for credit notes and the recorded payments. It blocks inconsistent totals and overpayments. Historical approved amounts are never rewritten. Draft line edits use the EN16931 rounding model; previously approved documents with incompatible figures cannot silently export different amounts.

The export endpoint is `/api/administration/peppol/prepare`: authenticated GET returns a validation report; same-origin POST downloads XML only when the checks pass. Each request rechecks current database permissions and organization approval. Preparation leaves `peppol_status` unchanged.

The isolated workflow tests the actual Settings approval, invoice approval, XML download, payments, staff/cross-origin denial and company-edit invalidation. Generated test documents and browser downloads are checked against UBL 2.1 XSD, CEN EN16931 and Peppol BIS Billing 3.0.21. Negative controls must detect an invalid schema value, a missing buyer reference and incorrect totals. These tests verify preparation; they do not certify an access-point connection or confirm that a recipient identifier is registered.

Reference revisions are pinned in `scripts/validate-peppol.py` and `.github/actions/peppol-validation/action.yml`. OpenPeppol release documentation: https://docs.peppol.eu/poacc/billing/3.0/ . The XSD distribution preserves the OASIS schemas with catalog imports supplied by the validation wrapper.
