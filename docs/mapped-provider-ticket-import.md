# Eventix / SumUp: mapped ticket CSV workflow

The Administration → Ticketing portal offers two **separate** import workflows:

- **Manual CSV**: the original normalized internal-event CSV format remains available unchanged.
- **Mapped provider CSV**: first create an Eventix or SumUp event mapping, enable it with the existing approval controls, choose the enabled mapping and import the provider-normalized sales CSV. The server checks the **mapping ID, provider, exact external event ID, internal event ID, and current enabled state** before calling the existing transaction-safe `upt_import_ticket_sales` RPC. A disabled, missing or mismatched mapping rejects the import without writing any sales.

## Mapped CSV schema

```csv
external_id,external_event_id,quantity,gross_amount,currency,sold_at
ORDER-001,provider:event-123,2,30.00,EUR,2026-11-09T20:00:00+01:00
```

Use an **external sale identifier** that is stable across re-exports. `external_event_id` must match the selected active provider mapping exactly. `gross_amount` is the row's total EUR amount (not a unit price). `sold_at` must include an explicit UTC offset. Export a supported normalized CSV from the provider and transform its columns to this schema **offline before import**; provider-native CSV structures are not assumed.

The preview verifies file limits, headers, event IDs, quantities, timestamps, currency, duplicates, and exact integer cents. Server validation repeats these checks. The stored `eventId` always comes from the authorized mapping, never the external CSV. Duplicate sales retain the existing all-or-nothing conflict behavior and idempotent skip policy implemented in PostgreSQL. Refresh mappings after another administrator enables one.

**Scope**: This is **not** an automated Eventix/Weeztix or SumUp API integration. No credentials, live payments, automatic imports, payout reconciliation, refunds, or provider webhooks are configured by this change. It creates a safe human-operated bridge until provider credentials and verified API contracts are available. No production CI/deploy is authorized by this change.
