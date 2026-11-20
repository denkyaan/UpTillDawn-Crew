# Financiële CSV-factuurregels — main-testworkflow

## Wat deze bundel toevoegt

Financiële administratie → **Factuurregels in één keer importeren** laat een geautoriseerde Administratiegebruiker
een genormaliseerde CSV uploaden bij een **bestaande EUR-aankoop- of verkoopfactuur met status concept**.

De app toont eerst de regels, berekende netto- en btw-bedragen. Na expliciete bevestiging worden
de regels in één databasetransactie toegevoegd en berekent het bestaande
`upt_admin_recalculate_financial_lines`-mechanisme de factuurbedragen opnieuw.

Het originele PDF-/afbeeldingsbewijs moet afzonderlijk als privébijlage bij de factuur worden toegevoegd.
Een CSV is niet automatisch geverifieerd, geen OCR en geen rechtsgeldig e-factuurbericht.

## CSV-indeling

```csv
description,quantity,unit_price,vat_rate
"Merchandising T-shirts",10,12.50,21
"Venue supplies",2,45.00,21
```

Gebruik **puntdecimale** waarden. Maximaal 100 regels en 100 KB per bestand. Hoeveelheid
1–100000 (maximaal 3 decimalen), eenheidsprijs 0–9999999 (maximaal 4 decimalen),
btw-percentage 0–100 (maximaal 2 decimalen). Enkel 4 expliciete kolommen in die volgorde.
Er worden geen ongeldige, gedeeltelijke, te grote of onvolledige batches opgeslagen.
Bestandsinhoud wordt als onbetrouwbaar beschouwd.

## Veiligheid

- Same-origin check, actuele sessie en databaseautorisatie zijn verplicht.
- Database lockt het doelconcept; niet-concepten, niet-EUR en andere documentsoorten worden geweigerd.
- Elke import heeft een UUID als aanvraag-ID en een SHA-256-bestandschecksum.
- De auditregistratie bewaart bestandnaam, checksum, regels, actor, tijdstip en document-ID.
- Een identieke herimport van hetzelfde bestand in hetzelfde concept slaat alle regels over.
  Een hergebruikte aanvraag-ID met andere gegevens faalt.
- Alle regels of geen enkele worden ingevoegd; de bestaande autoritatieve factuurtriggers berekenen bedragen.
- CSV-gegevens worden niet automatisch goedgekeurd, betaalbaar gesteld, naar Peppol verzonden
  of aan de voorraad toegevoegd.

Na factuurcontrole en Admin-goedkeuring kunnen **aankoopfactuurregels** via de reeds bestaande
**Administratie → Inventaris → Aankopen ontvangen**-workflow worden toegewezen aan
materiaal van hetzelfde evenement. Die ontvangst is een aparte geauditeerde Admin-handeling,
niet een automatische verhoging op basis van een aangeleverd bestand.

## Verificatie

- `tests/administration-invoice-lines-csv.test.mjs` valideert centen, decimalen,
  geciteerde velden, ongeldig bestand, workflowautorisatie, idempotentie en vier talen.
- Databaseversie: `20261109073000_admin_invoice_lines_csv_atomic.sql`.
- Pas de migratie uitsluitend toe op de main-testdatabase na groene PR-CI,
  merge daarna naar `main`, valideer `CI main` en `Deploy main`.
- De daadwerkelijke verwerking van een representatieve factuur moet nog met een
  geautoriseerde testgebruiker en synthetische factuurgegevens worden geaccepteerd.

**Buiten scope:** OCR van PDF/scans, supplier API-import, gesigneerde e-invoice-inname,
automatische voorraadboeking of wijzigingen aan production.
