# UpTillDawn — geïntegreerde E2E-eindvalidatie (7 domeinen)

Status: **NIET EINDGEVALIDEERD**. De 21 bestaande Playwright-tests bewijzen alleen de huidige contractsuite en de beperkte browsercontroles. Een groene run betekent niet dat alle onderstaande transacties getest zijn.

## Uitvoeringsvoorwaarden
- Uitsluitend geïsoleerde staging met afzonderlijke testaccounts en synthetische evenementen, personeel, betalingen en chatgegevens.
- Voor iedere test: aantoonbare beginsituatie, echte UI-interactie, server-side resultaatcontrole, verwachte meldingen, autorisatiecheck, en herstel/cleanup.
- Geen muterende test tegen productie. Geen geforceerde klikken, mock-success, of negeren van mislukte stappen.
- Rapporteer per case: **PASS / FAIL / BLOCKED / NOT RUN**, rol, taal, testdata-ID (geen PII), screenshot/trace en CI-run.
- Releasecriterium: alle P0/P1-cases PASS; geen BLOCKED/NOT RUN in kritieke workflows; nul onopgeloste kritieke defecten.

## 1. Functies en UI (P1)
- [ ] Per rol alle zichtbare acties inventariseren en koppelen aan een afzonderlijke werkende test (niet alleen zichtbaarheid).
- [ ] CRUD, formulier-validatie, annuleren, opslaan, wijzigen, foutmeldingen, paginering, filters, zoeken, uploaden/downloaden.
- [ ] Desktop, mobiel, toetsenbord en toegankelijke naam/feedback.

## 2. Rollen en bevoegdheden (P0)
- [ ] Admin, verantwoordelijke, medewerker, toegewezen meervoudige rollen, werkplekgebonden rechten.
- [ ] Directe URL/API-toegang geweigerd buiten bevoegdheid; niet alleen knoppen verbergen.
- [ ] Overdracht, deactivering, sessieverloop, gelijktijdige rollen en toegang tot andere evenementen.

## 3. Volledige workflows (P0)
- [ ] Registratie/inloggen/onboarding, evenement -> werkplek -> shift -> briefing -> taak -> uren -> afsluiting.
- [ ] Prioriteit/deadline/taaktoewijzing/escalatie; chats, privéchat, vermeldingen, uploads.
- [ ] Driver: aankomst, ritstart, kilometerregistratie, terugkomst, backstage-melding.
- [ ] Guestlist, entree, bar, merch, tokens, prijzen, voorraad, omzet en admin-goedkeuring.
- [ ] Promotie: campagne, bewijs/screenshot, review, historiek.
- [ ] Financiën: invoer/bewerking versus definitieve goedkeuring/verwijderen.

## 4. Meldingen en automatiseringen (P0)
- [ ] Elke trigger -> juiste ontvanger, kanaal, tijdzone, link, vertaling, gelezen-status.
- [ ] Deadlineherinnering, hogere prioriteit, verjaardag, shift, chat, driver-ETA en escalatie.
- [ ] Duplicaatpreventie, retries, offline/reconnect, ontbrekende toestemming.

## 5. Edge cases en beveiliging (P0)
- [ ] Lege/ongeldige invoer, dubbele submits, races, verloren netwerk, 4xx/5xx, verlopen sessies.
- [ ] Cross-event datalekken, RLS, XSS, uploads en achtergrondscan, toegangscontrole.
- [ ] Tijdzones, zomertijd, overlappende shifts, afgebroken ritten, ontbrekende locatie.

## 6. Regressie (P1)
- [ ] Unit/integratie, API/RLS, rolbrowserflows en vier talen in CI.
- [ ] Iedere nieuwe bug krijgt reproduceerbare test vóór fix.
- [ ] Traces, foutlogs en screenshots bewaren; flakiness meten; geen stilzwijgende retries als PASS.

## 7. Eindacceptatie (P0)
- [ ] Realistisch synthetisch evenement van registratie tot eindafrekening met alle rollen.
- [ ] NL, FR, EN, DE: labels, dialogen, meldingen, foutmeldingen, datum/valuta.
- [ ] Onafhankelijke beoordeling van alle resultaten, openstaande defecten en go/no-go.

## Huidige bewijsstatus
- Bestaande testsuite: 21/21 PASS in run 39559341976.
- Alle hierboven niet afzonderlijk bewezen scenario's: **NOT RUN**, niet PASS.
- Deze matrix is een uitvoerings- en acceptatiecontract; het toevoegen ervan is **geen uitvoering** van alle scenario's.
