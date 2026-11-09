# Bankafschrift ↔ geregistreerde factuurbetaling (main-testomgeving)

## Operationele workflow

**Administratie → Banking → Bankafschriften en factuurbetalingen afstemmen**.

1. Registreer eerst een **echte** factuurbetaling in het bestaande financiële register, inclusief **stabiele bankreferentie** en **werkelijke betaaldatum**.
2. Download het afschrift bij de bank en converteer de relevante afschriftregels buiten de app naar het **genormaliseerde CSV-formaat** hieronder. De app heeft **geen bank-API, PSD2-verbinding of live rekeninginzage**.
3. Voer de **IBAN van de rekening van de organisatie** in. De app controleert de IBAN-checksum en importeert maximaal 250 regels / 500 KB per bestand.
4. De gebruiker met Administratierechten kan de bestandspreview controleren en importeren. Geïmporteerde bankregels zijn append-only. Een reeds gekende identieke regel wordt overgeslagen; een afwijking met dezelfde `bank_account_iban + transaction_reference` verwerpt de **volledige batch**.
5. Het afstemmingsscherm toont alleen een voorstel wanneer referentie, datum en bedrag exact overeenkomen met **één** bestaande goedgekeurde factuurbetaling. Een verkoopfactuurbetaling vereist een positieve bankbeweging, een aankoopfactuurbetaling een negatieve.
6. **Alleen Admin** kan de bijbehorende ledgerbetaling en bankregel onomkeerbaar aan elkaar koppelen. De RPC controleert deze gegevens opnieuw in de database en weigert dubbelzinnige of reeds gekoppelde regels. De controle legt `approved_by` en `approved_at` vast.

### Voorbeeld van het exacte CSV-schema

```csv
transaction_reference,booking_date,amount,currency,counterparty_iban,description
BANK-001,2026-11-09,30.00,EUR,,Invoice settlement
BANK-002,2026-11-09,-12.50,EUR,,Supplier invoice
```

`transaction_reference` moet de unieke, stabiele referentie van de *banktransactie* zijn. Die moet ook exact gelijk zijn aan `bank_reference` van de intern geregistreerde factuurbetaling. Wanneer de bank andere referenties gebruikt, blijft de regel terecht ongematcht: er vindt **geen** gok op basis van enkel bedrag of omschrijving plaats. `booking_date` is ISO `YYYY-MM-DD`; `amount` is positief voor inkomende en negatief voor uitgaande bewegingen, precies twee decimalen maximaal; `currency` is uitsluitend `EUR`. `counterparty_iban` mag leeg zijn en wordt gevalideerd wanneer ingevuld. CSV-waarden met komma's kunnen tussen dubbele aanhalingstekens staan.

## Datamodel / veiligheid

- `admin_bank_statement_entries`: geïmporteerde, onveranderlijke bankwaarnemingen, RLS select voor geautoriseerde Administratie- en Adminaccounts; **geen directe INSERT/UPDATE/DELETE-rechten**.
- `admin_bank_payment_matches`: onveranderlijke, unieke één-op-één-relatie tussen bankwaarneming en **bestaande** `admin_financial_payments`-record, met Admin-identiteit en tijdstempel.
- `upt_import_admin_bank_statement`: beveiligde, atomische SQL-RPC met actuele rolcontrole en controle op dubbele of inconsistente regels.
- `upt_admin_confirm_bank_payment_match`: beveiligde, **Admin-only** RPC die opnieuw factuurtype/status, transactie-ID, datum, exact getekende bedragen, dubbele kandidaten en bestaande matches controleert.
- Alle server-API's eisen actuele roltoegang; elke mutatie vereist same-origin. Rapporten worden bij overschrijding van veilige limieten niet onvolledig gepresenteerd.
- **Er wordt geen factuur betaald gemarkeerd, geen betalingsrecord aangemaakt, geen bankbetaling uitgevoerd, geen automatische refund verstuurd, geen voorraadmutatie gemaakt.** Een geüpload bestand is geen onafhankelijke verificatie bij de bank.

## Oplevering / controle

Migratie: `supabase/migrations/20261109070000_administration_bank_statement_matching.sql`. De main-testdatabase moet deze migratie ontvangen **voor** gebruik van de module. De gewone Cloudflare-deployment voert geen Supabase-schemawijzigingen uit.

Automatische regressie: `tests/administration-bank-statement-reconciliation.test.mjs` (validatie, IBAN, veilige centen, inkomend/uitgaand, meerdere kandidaten, Admin-beperking en SQL-beveiliging). De PR-CI en een optionele databaseverificatie toetsen de applicatiecode; realistische handmatige financiële QA met accounts en een door de bank geleverd testafschrift blijft noodzakelijk. **Production blijft ongewijzigd.**
