# Banktransacties en factuurafstemming

Administratie > Banking bevat een afzonderlijke workflow voor handmatige bank-CSV-import en expliciete factuurkoppelingen.

**Aanname / beperking:** geïmporteerde bestanden zijn door de gebruiker aangeleverde gegevens. Er is geen live bank-API, PSD2-koppeling, bankafschrift-authenticatie of automatische bankverificatie. De Admin moet een transactie vergelijken met het echte bankafschrift voor een definitieve registratie.

## Genormaliseerd CSV-formaat

```csv
transaction_id,booked_on,direction,amount,currency,payment_reference,description
BANK-001,2026-11-09,credit,30.00,EUR,INV-2026-001,Received invoice payment
BANK-002,2026-11-09,debit,10.50,EUR,SUP-2026-001,Outgoing supplier payment
```

Bijschrijving `credit` kan alleen worden geboekt tegen een goedgekeurde of verzonden **sales_invoice**. Afschrijving `debit` kan alleen worden geboekt tegen een goedgekeurde of verzonden **purchase_invoice**. De status `paid` wordt niet automatisch op een factuur gezet; de bestaande Admin-statusovergang blijft vereist.

CSV heeft maximaal 500 transacties en 1 MB. `transaction_id` moet per bankrekening/gegevensbron uniek en stabiel zijn; wanneer meerdere rekeningen hetzelfde referentieformaat gebruiken, prefix de referenties per rekening vóór import. Het formaat bestaat uit komma-gescheiden waarden en ondersteunt correct gequote velden. `amount` is altijd positief in EUR met maximaal twee decimalen. De richting bepaalt positief/negatief kasverloop. `booked_on` is YYYY-MM-DD. De parser weigert gemengde corrupte batches volledig.

## Beveiliging en verwerking

De database beheert een append-only register `admin_bank_statement_transactions`. De gegevens zijn uitsluitend te lezen voor geautoriseerde Administratiegebruikers, zonder directe gebruikersrechten voor INSERT/UPDATE/DELETE. Een beveiligde import-RPC controleert opnieuw elke regel, herhaalde import, transactiereferentie en actor en voert de batch atomisch uit. Identieke gegevens worden overgeslagen; afwijkende herimport veroorzaakt rollback.

Admin kan per regel een concrete openstaande factuur selecteren en expliciet goedkeuren na controle van het bankafschrift. De SQL-RPC controleert `upt_is_admin()`, vergrendelt de bankregel én factuur, valideert factuursoort, betaalrichting, EUR, status, openstaand saldo inclusief goedgekeurde creditnota's en eerdere betalingen, schrijft een betaling in het bestaande `admin_financial_payments` register en slaat de link plus reviewer/audit-tijdstip op. `BANKSTMT:<uuid>` is uniek over alle facturen en voorkomt dubbele afstemming. Er kunnen deelbetalingen worden verwerkt, nooit meer dan het resterende saldo.

Admin kan een niet-relevante regel met een verplichte reden (5–500 tekens) definitief negeren. Geboekte en genegeerde transacties kunnen niet over en weer worden gewijzigd. De handeling wordt samen met de actor en het tijdstip vastgelegd.

## Valideren en uitrollen

Migration: `supabase/migrations/20261109070000_administration_bank_statement_invoice_matching.sql`. Voor het hoofdtestsysteem toepassen op de **main-test database**, niet op productie. De Worker-deploy voert geen Supabase-migraties uit. Verifieer daarna RLS, RPC-grants, unieke referenties en functionele tests; controleer met echte goedgekeurde testfacturen in een geïsoleerde testomgeving.

De webinterface en API voorzien GET, POST en PATCH, 4 talen, een CSV-voorbeeld, importpreview, de status per bankregel, paginering, openstaande factuurselectie en bevestiging voor Admin. Regresstests zijn ondergebracht in `tests/administration-bank-statement-e2e.test.mjs`.

**Buiten scope:** rechtstreeks inloggen bij banken, PSD2/SEPA-afschriften ophalen, facturen automatisch markeren als betaald, automatische matching op onbewezen referenties, crediteurenbetalingen uitvoeren, refunds verzenden of productie wijzigen.

## Reeds geregistreerde betalingen afstemmen (vervolgbundel)

Een bankregel kan overeenkomen met een **betaling die al handmatig in het factuurregister is vastgelegd**.
Boek deze regel nooit opnieuw. De module stelt alleen een bestaande betalingskoppeling voor wanneer
**bankreferentie (niet leeg), boekingsdatum, bedrag en inkomend/uitgaand** exact overeenkomen.
Bij meerdere kandidaten volgt geen automatische selectie: Admin moet de gegevens eerst verduidelijken.

Met **Koppel reeds geboekte betaling** kan Admin de bestaande boeking na vergelijking met het
originele bankafschrift bevestigen. De beveiligde RPC verifieert opnieuw rol, factuursoort,
factuurstatus, valuta, referentie, datum, bedrag, uniciteit en de bestaande link;
de bestaande betaling en het factuursaldo blijven volledig ongewijzigd.
De SQL-blokkering voorkomt daarnaast dat dezelfde factuur een identieke betaling nogmaals
uit de geïmporteerde bankregel ontvangt. Bij ontbrekende of ambigue referenties is geen
automatische koppeling mogelijk; losse claims uit CSV vormen geen onafhankelijk bankbewijs.

Aanvullende migratie: `supabase/migrations/20261109071500_admin_bank_existing_payment_link.sql`.
Voer deze uitsluitend op de main-testdatabase uit na geslaagde snelle PR-CI.
Regressietests: `tests/administration-bank-statement-existing-ledger.test.mjs`.
