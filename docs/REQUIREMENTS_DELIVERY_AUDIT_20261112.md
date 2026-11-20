# UpTillDawn Crew + God Mode — definitieve eisencontrole (Main)

**Peildatum:** 12 november 2026. **Omvang:** de eerder gevraagde aanpassingen, verbeteringen, rollen, automatiseringen en God Mode, beoordeeld op daadwerkelijk aantoonbare implementatie. **Main** blijft de ontwikkel-/testapp; dit verslag autoriseert geen productiewijziging.

## Bewijsniveaus

1. **Code aanwezig:** relevante route, component of SQL-migratie bestaat.
2. **Automatisch getest:** bijbehorende tests bestaan en de betreffende GitHub CI-run is geslaagd.
3. **Geïsoleerd E2E bewezen:** een echte browser-/databaseflow is uitgevoerd tegen de tijdelijke teststack.
4. **Live Main bewezen:** de actuele gedeployde Worker met de juiste ingelogde rol is doorlopen.
5. **Externe provider bewezen:** echte sandbox-/testlevering of apparaatinteractie, inclusief correcte ontvangst, foutpad en reconciliatie.

Een lager niveau bewijst **niet** automatisch een hoger niveau. Geen percentage of 100%-claim zonder alle verplichte niveaus. De machineleesbare basismatrix staat in `scripts/main-requirements-audit.mjs`.

## A. Gevraagd product — status per werkstroom

| Gebruikersvereiste | Bronbewijs | Beoordeling |
| --- | --- | --- |
| Maker/Owner los van hoofdadmin, inclusief leiding en twee rollen per personeelslid | `components/admin/personnel-two-role-editor.tsx`, `tests/owner-separation-regression.test.mjs`, `tests/portal-role-atomic-contract.test.mjs` | Code + geïsoleerde tests; daadwerkelijke rolwijzigingen op live Main nog afzonderlijk bevestigen |
| Admin, Administratie, Promotie, Verantwoordelijke, Personeel en Maker-portaal; logische tabs/subtabs zonder dubbele snelkoppelingen | `components/administration/administration-navigation.tsx`, `tests/unified-mobile-admin-administration-navigation.test.mjs` | Code + browsertests; nog niet alle live mobiele apparaten |
| Beschikbaarheid, eventplanning, werkplek/shifts, briefings, QR-check-in, pauzes, uren en correcties | `components/crew/workplace-shift-planner.tsx`, `components/crew/timesheet-controls.tsx`, `tests/crew-availability-shift-response-integrity.test.mjs`, `tests/break-compliance.test.mjs` | Code + geïsoleerde E2E; echte eventdienst niet bevestigd |
| Driver en standaardwerkplekken Lockers/Stage Managers | `components/crew/driver-transport-form.tsx`, `supabase/migrations/20261111083000_add_lockers_and_stage_managers_workplaces.sql` | Code/migratie + SQL-test; echte GPS-kilometerregistratie niet afzonderlijk bewezen |
| Chat per rol/event, Promotiechat, leesbewijzen en vier talen | `components/promotion/promotion-chats-client.tsx`, `tests/promotion-chat-private-replies-read-security.test.mjs`, `tests/chat-live-translation.test.mjs` | Code + automatische tests; live multi-device push/read-ack niet onafhankelijk bewezen |
| Promotietaken, bewijs en strikes | `components/promotion/promotion-publication-links.tsx`, `tests/promotion-evidence-security.test.mjs`, `tests/promotion-discipline-security.test.mjs` | Code + automatische tests; echte sociale-netwerkpublicatie niet bewezen |
| Administratie: DJ-contracten, facturen, documenten, bankreconciliatie, inventaris, ticketimport, uren en goedkeuringen | `app/(app)/portals/administration/modules/artists/[id]/agreement/page.tsx`, `components/administration/bank-statement-workspace.tsx`, `tests/provider-bank-settlement.test.mjs` | Code + geïsoleerde transactietests; providerlevering/boekhouding nog niet integraal bewezen |
| Peppol | `components/administration/peppol-preparation.tsx`, `tests/administration-peppol.test.mjs` | UBL/voorbereiding aanwezig; niet gelijk aan echte Peppol-verzending en ontvangst via een access point |
| Weeztix inkomscanner | `components/crew/weeztix-scanner-panel.tsx`, `tests/weeztix-in-app-scan.test.mjs` | Beveiligde scanflow aanwezig; echte providerbarcode, eventafbakening en toestelcamera nog te accepteren |
| EventPay-RFID/QR: Bar, Merch, Tokens en herladen | `docs/EVENTPAY_CASHLESS_BAR_MERCH_TOKENS.md`, `supabase/migrations/20261112062000_eventpay_readonly_statement_reconciliation.sql` | **Niet klaar:** uitsluitend invoer/afstemming van transactieoverzichten; geen in-app kaartbetaling, herlading, geldige scan→productmenu→providercharge→bevestiging |
| God Mode: exclusieve Owner, bronbewerking, AI, SQL, Main/productie-overzicht, logexplorer | `components/god-mode/god-studio.tsx`, `scripts/god-mode-maker-e2e.mjs`, `tests/god-mode-maker-e2e-contract.test.mjs` | Code + echte Maker-flow in geïsoleerde E2E geslaagd; niet elk live code-/rollbackpad bewezen |
| Error-AI: detectie, triage en verantwoord herstelbewijs | `lib/god-mode-error-triage.ts`, `lib/god-mode-resolution-evidence.ts`, `tests/error-ai-runtime-adversarial.test.mjs` | Diagnostiek/voorstel/afsluitcontrole aanwezig; **volledig autonome realtime bugfix→regressie→release→hertest niet geleverd als bewezen onbeheerde cyclus** |
| God Mode: alle Cloudflare Worker-runtime-logs | `app/api/god/cloudflare-logs/route.ts`, `tests/god-mode-cloudflare-live-log-api.test.mjs` | Beveiligde route en Worker-secret op Main **aanwezig**, anonieme 401 bevestigd; live ingelogde log-query/resultaat **niet bewezen** |
| Eén bot per bedoelde rol (zeven bots) | `scripts/seed-15-bot-users.mjs`, `scripts/e2e-all-portals.mjs` | **Niet bewezen:** 15-bot stress-fixture omvat admin, verantwoordelijke en vooral personeel; aparte zes-rollen E2E is geen bewijs van zeven permanente rolbots |
| Automatiseringen, mobiele navigatie, offline/push en vertalingen NL/FR/EN/DE | `tests/offline-replay-reconnect-hardening.test.mjs`, `tests/ui-translation-coverage.test.mjs`, `tests/navigation-ai-overlay-regression.test.mjs` | Code + geïsoleerde tests; real-device/offline-/reconnect-acceptatie vereist |

## B. Repository, CI, database en release

- CI Main run [43224637679](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/43224637679) was geslaagd op `93a82dc5ab7cd9a0124a10cd60ff61847d8e730a`, inclusief echte geïsoleerde Maker-browsertest en geautomatiseerde applicatietests.
- Deploy Main run [43229059793](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/43229059793) is geslaagd voor dezelfde SHA. Dit bewijst deployment, niet elk live extern gebruikerspad.
- De beveiligde Cloudflare secretnaam `CLOUDFLARE_OBSERVABILITY_CONFIG` op `uptilldawn-main` en afwijzing van anonieme God Mode-logvragen met HTTP 401 zijn bevestigd in [43243191552](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/43243191552); de tokenwaarde werd niet gelezen. Authenticated Cloudflare-logdata ontbreekt nog als bewijs.
- **Eenmalige alleen-lezen databasevergelijking, 12 november 2026:** Main bevat 107 publieke tabellen, productie 103. Alleen op Main staan `training_progress`, `training_questions`, `training_scenario_members` en `training_scenarios`. De 18 vereiste productiecontracten met in totaal **76 kolommen** bestaan in beide databases (geen ontbrekende kolommen in deze steekproef). Dit bewijst niet dat RLS, routines, migratiegeschiedenis, providers, back-ups en volledige databases identiek zijn.
- Oude **PR #289** breidde productiecontrole uit van 11 naar 18 relaties, maar was gebaseerd op een oude branch en bevatte de inmiddels verouderde claim dat tientallen productietabellen ontbreken. Het veilige deel is nu in deze Main-bundel overgenomen: `scripts/production-schema-contract.mjs` + `app/api/god/overview/route.ts` + tests. De legacy PR kan na geslaagde samenvoeging als vervangen worden gesloten.
- De bestaande vijf GitHub Actions workflows blijven ongewijzigd in aantal. Er is geen staging-workflow. Geen productie-CI/deploy zonder expliciete releaseopdracht.

## C. Resterende actiepunten en harde afhankelijkheden

1. **EventPay POS/RFID/QR:** officiële EventPay-partner-API of door de leverancier ondersteunde terminal- en testdocumentatie met sandbox-toegang. Daarna pas implementatie van kaartlookup, winkelmand, officiële charge/top-up, idempotente webhook, refunds, voorraadmutatie na bevestiging, role/event/stand-scoping en test van verloren verbinding. **Nooit** een gesimuleerde kaartbetaling als geslaagd presenteren.
2. **Rolbots en QA:** bepaal de exact bedoelde zeven rolbot-identiteiten; koppel de ontbrekende afzonderlijke testaccounts. De directe Main-browsertest vereist zes onafhankelijke QA-accounts met GitHub Actions-secrets. Bestaande lokale fixtures mogen niet worden voorgesteld als permanente Main-accounts.
3. **God Mode echte herstelcyclus:** beschermde Main PR→CI→Deploy Main→herhaal foutsituatie, plus veilige terugdraai-test en auditlog. Technische limieten, goedkeuringen en productieafscherming blijven gelden.
4. **Providers:** bevestigde EventPay, Weeztix, Peppol-access-point, bank-/handtekening- en ticketintegratie, uitsluitend met sandbox/testgegevens en passende rechten.
5. **Operationele acceptatie:** echte iPhone/PWA, QR en RFID-hardware, GPS/kilometers, netwerkverlies, notificaties, multi-device chat en volledige rolwissel over meerdere sessies.
6. **Herstel en productie:** restorable backup in een geïsoleerd project, DB-migratie-/RLS-pariteit, uitgebreide productiesmoke en afzonderlijke expliciete productieautorisatie. De vier trainingsrelaties zijn niet automatisch weg te gooien zonder bewijs van opslag-/retentie-impact.

## D. Definitie van 'alle verbeteringen af'

Pas afmelden wanneer **alle** eerder gevraagde functies óf correct geïmplementeerd en volgens de vereiste laag bewezen zijn, óf uitdrukkelijk als afhankelijkheid met naam/eigenaar zijn vastgelegd en door de eigenaar als buiten scope zijn goedgekeurd. Geen onbevestigde claims van 100% gereed.

**Oordeel op peildatum:** uitgebreide functionaliteit en verbetering aanwezig op Main, maar niet alle gevraagde functionaliteiten zijn af. Met name EventPay live POS, het expliciete zevende rolbot-vereiste en volledig autonoom foutreparatie-/releasetraject zijn geen bewezen voltooide onderdelen.
