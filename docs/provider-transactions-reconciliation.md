# Provider-transactieafstemming — Eventix en SumUp

## Functionele workflow

Administratie → **Banking** bevat een afzonderlijke kaart **Providerbetalingen en terugbetalingen**.

1. Maak een Eventix- of SumUp-koppeling naar het juiste interne evenement onder **Administratie → Ticketing** en activeer deze met de bestaande rechten.
2. Exporteer de providertransacties en zet ze buiten de app om naar de onderstaande **genormaliseerde CSV-indeling**. De native Eventix/SumUp CSV-schema's en API's worden niet verondersteld of automatisch geparseerd.
3. Kies de actieve koppeling. De lokale preview controleert externe evenementidentiteit, transacties, status, EUR-bedragen, tijdstippen en duplicaten.
4. Leg expliciet vast. De beveiligde serverroute controleert de actieve koppeling opnieuw en roept de database-RPC aan. De RPC leest provider- en interne evenementidentiteit uitsluitend van de vergrendelde koppeling, valideert alle regels en schrijft in één transactie.
5. De kaart toont door de provider gerapporteerde betaalde bedragen, terugbetalingen en netto bedragen voor **tickets, merch en tokens**, plus niet-gematchte, conflicterende en openstaande transacties. Download het afzonderlijke financiële afstemmings- en uitzonderingenoverzicht als CSV.

### CSV-formaat

```csv
transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at
PAY-001,provider:event-123,tickets,ORDER-001,paid,30.00,EUR,2026-11-09T20:00:00+01:00
REF-001,provider:event-123,tickets,ORDER-001,refunded,5.00,EUR,2026-11-09T20:10:00+01:00
```

De gegevens moeten uit de provider afkomstig zijn. Bedragen zijn positieve EUR-bedragen met maximaal twee decimalen; refunds worden als **positieve** terugbetalingsbedragen in een afzonderlijke transactie vastgelegd. `sale_reference` moet dezelfde geverifieerde verkoop-ID identificeren; een refund zonder passende betaalde transactie wordt als conflict gesignaleerd en **niet** afgetrokken van aanvaarde inkomsten. Elke `transaction_id` moet per provider stabiel zijn; pending→paid mag hetzelfde ID met verschillende status zijn. Een terugbetaling heeft een eigen uniek transactie-ID.

CSV-limiet: 1 MB, maximaal 500 records per import. Bestaande identieke snapshots worden overgeslagen; een afwijking in status-snapshot of identiteit blokkeert **de hele batch**, met rollback. De database bewaart de originele providerstatus en exacte integercenten. Geen update/delete-toegang voor reguliere gebruikers.

## Veiligheid en scope

- **Geen** automatische factuurbetaling, bankboeking, Peppol-verzending, verwerking van betalingen, geldtransfers, afschrijving van voorraad of bevestiging van uitbetaling.
- Ook **geen** automatische Eventix/SumUp API-synchronisatie: eerst provideraccount-toegang, geteste API-contracten, verificatie van callbacks en een aparte afstemmings-/goedkeuringsworkflow nodig.
- Eventuele gedeelde `sale_reference` van twee providers moet daadwerkelijk hetzelfde onderliggende verkoop-ID voorstellen. Gelijke bedragen of tijdstippen alleen volstaan niet.
- De financiële resultaten zijn **alleen door de provider aangeleverde gegevens**, geen geverifieerde bankontvangsten.
- Read-only rapport is fail-closed bij ongeldige databasegegevens, inconsistente aantallen of meer dan 5000 snapshots. Voor grotere volumes is gepagineerde, database-side afstemming nodig.
- REST POST vereist origincheck, actuele Administration-autorisatie, een echte actieve event mapping en de geïsoleerde beveiligde RPC. De SQL-policy geeft de applicatie alleen SELECT op het register.
- De migratie is opgenomen in `supabase/migrations/20261109063000_administration_provider_transaction_reconciliation.sql`. **Controleer de doelomgeving en voer de migratie uit vóór gebruik van de nieuwe kaart**. Een Cloudflare-code-deploy past geen Supabase-schema automatisch toe. Productie wordt niet op eigen initiatief gewijzigd.

## Verificatie

`tests/administration-provider-transaction-e2e.test.mjs` controleert normale import, bedragen, refunds, mapping-mismatch, invalidaties, atomische batchafwijzing, reconciliatie, SQL-beveiligingsvereisten en portalnavigatie. Een echte database-RPC-e2e met bevoegd Admin-/Administratieaccount vereist een geïsoleerde testdatabase waarop deze migratie is toegepast.
