# EventPay — normalized internal payment boundary (NO LIVE MONEY)

This candidate contracts a **future** provider adapter only. No EventPay
merchant session, RFC/SWIFT credentials, endpoint, webhook, wallet lookup,
card UID/QR parsing or event mapping is yet approved; none is guessed or
hardcoded. The genuine EventPay Belgium provider (eventpay.be) advertises
cashless RFID/QR and integrations, but a public marketing page is **not**
sufficient documentation for an authenticated charge/top-up API.

`modern/src/shared/eventpay-policy.ts` keeps a future internal
provider-agnostic contract limited to:

1. Local, integer-cent **EUR estimate** using prevalidated catalog data
   within the correct Bar or Merch category. Never writes money or stock.
2. Exact, unambiguous, vendor-verified transaction evidence before any
   future ledger update: confirmed status, provider event, workplace, amount,
   currency, order kind and unique transaction ID. This is an internal type,
   NOT an invented EventPay external API schema; the connector must
   independently authenticate official provider evidence and enforce atomic
   DB uniqueness, shift scope, pricing and authorization.
3. A top-up is a **wallet liability**, not a product sale; refunds remain
   separate. No double-counting loaded value as bar/merch turnover.

A transaction timeout/offline event never implies success. EventPay
RFID readers are hardware-specific; generic iOS NFC support cannot be
assumed. The current UpTillDawn legacy EventPay integration also remains
only a specification, not a production payment processor.

**To enable actual cashless checkout in the modern app:** obtain official
EventPay partner API/terminal docs and operator-level client registration;
provide an event-scoped sandbox test connection for the end user to sign
into inside Administration and a provider-signed confirmation test. Then
implement server-side verified transaction capture/idempotent webhook and
atomic stock/accounting reconciliation under auditable role/shift RLS.

No payment UI, direct card or wallet mutation, new schema, new API route,
Production deploy or existing-money calculation was added by this bundle.
Reference: https://eventpay.be/integraties/ .
