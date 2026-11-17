# UpTillDawn — integrale Main-bundel: functies, integraties, Production-voorbereiding
Datum: 2026-11-17 (Europe/Brussels)

## Reikwijdte en toegangsgrenzen

- **Main**: bronrepo `denkyaan/UpTillDawn-Crew`, test Worker `uptilldawn-main`, aparte bestaande Supabase-projectref `npbjrtiolqperdgljnhi` (historische projectnaam *uptilldawn-staging*; er is géén staging-deployment).
- **Production**: Worker `uptilldawn-crew`/publieke alias `crew`, Supabase-projectref `eakoavcieossazqzplke`; uitsluitend metadata-read-only inspectie. Er is geen CI production gestart, geen productie-DB gewijzigd en geen production deployment toegestaan zonder nieuwe expliciete opdracht.
- Testaccounts zijn uitsluitend de zeven bestaande Main-QA-bots. Geen echte betaling, e-mail, ondertekening of rekeningmutatie in een gedeelde omgeving.
- Een geslaagde fast CI/deploy of een statische test is niet gelijk aan een voltooide fysieke end-to-end gebruikersreis.

## 1. Functionele eindcontrole en verbeteringen op Main

Bewezen **vóór deze bundel**, op commit `6a695bdc`:
- [Deploy + browser- en functionele E2E](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/44065144888): geslaagd.
- Zeven rollen, vier talen, mobiele en desktopnavigatie: **134/134** browsercontroles geslaagd.
- Functional QA met een exclusief synthetisch QA-event: eventconcept, personeelslid, beschikbaarheid, urenstaat (indienen/afwijzen/herindienen/goedkeuren/vergrendelen), DJ-booking, afscherming van onbevoegde schrijfacties, clientweergave en cleanup.

Deze bundel **breidt het echte Main-only functionele bewijs uit** met:
- RLS-gescheiden toegang tot de drie bestaande standaard organisatiechats (Admin/Administratie, evenementen, promotie) voor Head Admin, Administratie, Staff en Promotie.
- Een **nieuwe uitsluitend voor QA aangemaakte werkpost**, een ingeplande Staff-shift, een werkpostbriefing, een weergave onder de werkelijke Staff-sessie en het blokkeren van een vervalste shift door Promotie.
- Verplichte opruiming van alle nieuw aangemaakte event-, shift-, werkpost- en briefingrecords met verificatie van het exacte eventeigenaarschap; geen GPS-check-in, urenstart of externe meldingen gesimuleerd.

Het extra bewijs wordt pas als **geslaagd** beschouwd wanneer de concrete nieuwe Main-deploy en beide Main-E2E-runs groen zijn. Financiële documentmutaties, fysieke scanapparaten, handtekeningwebhooks en reële push-aflevering blijven aparte acceptatiepunten wegens audit-/provider-/apparaatgrenzen.

## 2. Integraties op de juiste bestaande schermen

Alle configuraties gebruiken één bestaande AES-256-GCM-versleutelde opslag, een bestaande rechten-RPC en dezelfde afgeschermde API. De Maker is zonder een goedgekeurde zakelijke Admin/Administratiebevoegdheid geen bank- of betaaleigenaar.

| Bestaand scherm | Dienst / gedrag | Acceptatiegrens |
| --- | --- | --- |
| Admin → Sales | EventPay en SumUp (één gedeelde opslag) | EventPay uitsluitend eigen officiële POS/terminal tot leverancieradapter is goedgekeurd; nooit fictieve wallet of betaling |
| Administratie → Bank en betalingen | Bank/Ponto, **dezelfde** EventPay-/SumUp-instellingen als bij Admin Sales | Providercredentials moeten apart worden ingericht en getest |
| Administratie → Contracten | Documenso | Ondertekeningsverzending en webhookbewijs niet live-gecertificeerd |
| Administratie → Facturatie | Billit-sandbox/Peppol | UBL-voorbereiding ≠ wettelijke verzending |
| Administratie → Ticketverkoop | Weeztix voor **inkomscan**, Eventix voor bestaande import | Scannen alleen bij bevestigde eventbinding en leverancierresponse |
| Administratie → Documenten | Browserlokale OCR, Cloudmersive optioneel | Geen automatische boekhoud- of voorraadmutaties op OCR |

Een fout bij het lezen van de versleutelde connectieregistratie wordt in alle **NL/FR/EN/DE** als *niet beschikbaar* weergegeven. Dit wordt nooit stilzwijgend **niet ingesteld**. De businessautorisatie is per HTTP-request beveiligd en met React `cache()` uitsluitend per renderrequest samengevoegd om overbodige databasevragen te vermijden.

### Live verbindingsstatus (read-only, 2026-11-17)

- **Main Worker**: `UPT_INTEGRATION_ENCRYPTION_KEY`-binding **aanwezig**, vastgesteld in succesvolle Main-deploylog. De geheime waarde is niet ingezien.
- **Main** en **Production**: `upt_private.integration_connections` heeft **nul opgeslagen providerrecords** (alleen providernaam/count gelezen, geen secrets).
- Geen officieel geverifieerde EventPay-wallet/QR-RFID endpointcontracten, geen leverancier-testtransacties, geen Documenso handtekening of Billit Peppol-delivery bewezen. Geen live verbinding claimen en geen provideractie opstarten zonder bevoegde zakelijke credentials en acceptatie.
- Handmatige CSV-/reconciliatieworkflows, lokale document-OCR en officiële EventPay-POS blijven de veilige terugvaloptie.

## 3. Production-releasevoorbereiding, zonder release

De production-referentie heeft **een andere, historisch uitgelijnde migratieketen**: daarom nooit `supabase db reset`, nooit alle Main-migraties blind herhalen en nooit Production-DLL/rolrechten wijzigen om enkel een checklist groen te krijgen.

**Gecontroleerde metadata (2026-11-17):**
- Main laatste geschiedenisversie: `20261112220202`; Production laatste geschiedenisversie: `20261112062000`.
- Main: **108** publieke tabellen/views; Production: **104**. De vier uitsluitend op Main aanwezige tabellen zijn oude trainingsrelaties en worden **niet** zomaar naar productie overgebracht.
- De overige verschillen in kolomvolgorde werden gezien; voor de negen afwijkend gehashte kernrelaties bleken **kolomnamen en SQL-typen gelijk**. Dit vervangt geen volledige index-/constraint-/RLS-/functionele parity-check.
- De read-only `scripts/production-preflight-readonly.sql` rapporteert **Main 8/8 vereiste checks**, **Production 5/8**. Drie blokkades:
  1. `public.upt_administration_save_event_draft(uuid,text,timestamptz,timestamptz,text)` **ontbreekt** op Production.
  2. `public.upt_current_effective_role()` bevat op Production niet de expliciete Maker/Owner-scheiding die Main heeft.
  3. De productievariant biedt daardoor niet bewezen dezelfde keuze van de drie Maker-rolmodi.
- Beide Supabase-projecten zijn bereikbaar; de Security Advisor rapporteert nog o.a. *Leaked Password Protection Disabled*. Dit blijft volgens expliciete productkeuze voorlopig ongewijzigd.

**Harde releasegates vóór enig nieuw productie-deployverzoek:**
1. Een beoordeeld **voorwaarts Production-migratieplan** voor uitsluitend ontbrekende/afwijkende functies, inclusief permissies, RLS, regressietests, audit en herstelprocedure. Nooit eigenaarrechten simuleren via `user_metadata`.
2. Re-run `scripts/production-preflight-readonly.sql` op Production: elk `required=true` item **PASS**. Controleer ook de 18-tabellen/kolommen-gate en volledige schema/RPC-pariteit.
3. Verifieer de bestaande *production-current* referentie, back-up/restore-opties, veilige operationele rollback en productie-gerichte secret-/providerinstellingen. Een echte herstelproef naar een nieuw project kan kosten meebrengen en vereist aparte toestemming.
4. Volledige **CI production op exacte goedgekeurde commit** pas na expliciete gebruikersopdracht. Bij een rode gate: niets publiceren.
5. **Deploy production** uitsluitend na groen volledige Production-CI en afzonderlijke uitrolopdracht; controleer daarna de werkelijke login, RLS, rolmodus, contracten, financiële routes en logs.
6. Controleer in het Cloudflare-dashboard of eventuele historische externe **Workers Builds direct op `main`** nog actief zijn. De GitHub-releaseworkflow is handmatig; een losstaande Cloudflare auto-publish op `main` zou die veiligheidsgrens ondermijnen.

**Status:** Production-update geblokkeerd op drie actuele vereiste contractverschillen en extern/providerbewijs. Deze bundel maakt de verschillen reproduceerbaar, maar **herstelt Production niet ongemerkt**.


## Aanvulling: functionele acceptatie en gerichte Production-uitlijning (17 november)

- Op Main commit `e401f83cd678bcb3dee57227b2ac3217e537e488` is [Deploy main #44072391689](https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/44072391689) volledig **geslaagd**: functioneel **24/24**, zevenrollen-browser **134/134**, testfixture-cleanup bevestigd. De runtimecontrole meldde geen Worker-resourceoverschrijdingen. Vier tijdelijke Auth-500-antwoorden onder belasting waren nog een aandachtspunt; ze veroorzaakten geen testfout.
- De gerichte Production-voorbereiding en externe provideracceptatiematrix staan nu in [PRODUCTION_TARGETED_ALIGNMENT_AND_PROVIDER_ACCEPTANCE_20261117.md](PRODUCTION_TARGETED_ALIGNMENT_AND_PROVIDER_ACCEPTANCE_20261117.md).
- De uitgebreidere read-only Production-preflight bevat nu twaalf verplichte contracten. **Main 12/12** en **Production 6/12**; de zes ontbrekende controles zijn teruggebracht tot twee inhoudelijke RPC-verschillen. Een gecontroleerde, niet-toegepaste Production-SQL-bundel staat in `supabase/upgrades/production-role-administration-alignment-20261117.sql`.
- De daadwerkelijk vereiste Production-prechecks en beide vervangende functiedefinities zijn zonder blijvende wijzigingen in rollback-transacties geverifieerd. Externe providerverbindingen moeten door de bevoegde beheerder worden ingericht; er zijn nul app-managed providerrecords bevestigd op beide projecten.
- **Status: Main functioneel geslaagd; nieuwe Production-bundel is voorbereidend en geen toestemming voor databasemutatie of uitrol.**
