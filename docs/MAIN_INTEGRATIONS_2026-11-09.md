# UpTillDawn main — aansluitingen en eigen ticketscanner (2026-11-09)

## Besluit: minimum koppelingen, geen schijnbevestigingen
Alle wijzigingen blijven op **main**. Productie, productiedatabase en productie-CI/deploy mogen uitsluitend op afzonderlijke expliciete opdracht worden aangepast. Deze bundel configureert geen echte externe accounts en gebruikt geen betaalkaarten, bank- of productietokens.

### Weeztix: in-app inkomscanner
- De bestaande Inkom/Entrance-werkplek bevat een **native camera met lokaal gebundelde jsQR 1.4.0** (Apache-2.0, vastgepind op cozmo/jsQR commit `8e6a036beafa7053dd44b1b76ac578d22b1b3311`). Handmatige barcode-invoer is de fallback; scannerapp-links zitten alleen achter de bestaande reserve-optie.
- De app stuurt de gedecodeerde barcode **nooit** direct uit de browser naar Weeztix, maar naar een same-origin beveiligde route. Deze verifieert de actieve gebruiker, portaalgoedkeuring, event, inkomwerkplek en een dienstrooster of verantwoordelijkheidsassignment. Het normale serversecret verschijnt niet in de browser.
- De officiële Weeztix API ondersteunt `POST https://api.weeztix.com/order/scanbarcode/:barcode`. **Alleen HTTP 204 van Weeztix wordt als GOEDGEKEURD weergegeven.** Onbekende/afgewezen/geweigerde/timeout/geen verbinding is rood en verleent nooit toegang.
- De API scant daadwerkelijk in bij Weeztix: dit is **niet** alleen een validatie. Gebruik uitsluitend een geïsoleerd testevent en testbarcode tijdens acceptatie.
- Server-secretbindingen in **main Worker** (Cloudflare Worker Settings → Variables and Secrets):
  - `WEEZTIX_ACCESS_TOKEN`: server-only OAuth access token verkregen volgens officiële Weeztix OAuth-documentatie; vervalt normaal na ~3 dagen en moet verversen met een veilige server-side auth flow. Een geldige token is nog geen bewijs van autorisatie.
  - `WEEZTIX_ACTIVE_EVENT_ID`: exacte *interne* UUID van één UpTillDawn-event, niet de externe Weeztix GUID.
  - `WEEZTIX_SCANNING_ENABLED=true`: pas activeren na eventbinding, permissiecontrole en proefscan.
- **Belangrijke beperking:** Het gedocumenteerde scan-endpoint retourneert bij 204 geen event-GUID. De in-app gate koppelt dus het interne event en de ingeplande scanner, maar kan niet zelfstandig bewijzen dat de barcode bij het gekozen Weeztix-event hoort. De provider-credentials moeten daarom beperkt zijn tot het juiste event/bedrijf; laat Weeztix bevestigen hoe dat wordt afgedwongen. Weeztix-documentatie zegt dat OAuth-scopes momenteel nog niet gebruikt worden. Totdat de eventgrenzen zijn geverifieerd, geen toegang bij echte evenementen.
- Offline: de app **mag niet** op basis van een lokaal gelezen QR toegang toestaan; de officiële Weeztix-app kan vooraf synchroniseren en daarna offline scannen. Er wordt geen onbetrouwbare offline-acceptatie bijgehouden.
- iOS: Safari's ingebouwde BarcodeDetector is niet betrouwbaar beschikbaar; daarom draait jsQR lokaal via HTTPS-camera `getUserMedia` in de PWA. Test fysieke QR-codes, weergave, iPhone-geheugen, camera-machtiging en storing.
- Links: https://docs.weeztix.com/api/dashboard/scan-in-barcode-order/ ; https://docs.weeztix.com/docs/introduction/authentication/create-client/ ; https://docs.weeztix.com/docs/introduction/authentication/request-token/ ; https://dashboard.weeztix.com .

### Antivirus voor uploads: Cloudmersive nu, ClamAV alleen met aparte infrastructuur
- Geen verwijdering van de bestaande server-side quarantaine. Cloudmersive voor malware-detectie is de kortste weg: beveiligde Edge Function `malware-scan`, eigen `CLOUDMERSIVE_API_KEY`, apart per Supabase-project, fail-closed test met clean/infected testbestanden.
- Voor een gratis opensource-scanner kan ClamAV later in aparte geïsoleerde Docker/VPS draaien met `clamd`, vaste TLS-proxy, auth, virusdefinitie-updates, observability, rate limiting, temp-bestandscleanup en retry. Cloudflare Workers draaien ClamAV zelf niet. Hosting en onderhoud zijn niet gratis.
- Gewone OCR blijft standaard lokaal, zonder Cloudmersive OCR API.

### Peppol: Billit sandbox als voorkeursroute
- Billit heeft Belgische e-facturatie en een gescheiden sandbox met gedocumenteerde API. Maak op https://my.sandbox.billit.be een testbedrijf en activeer Peppol ontvangen, inclusief tests, voordat je productie registreert.
- Voor eigen interne niet-commerciële integraties geeft Billit volgens de documentatie een Party ID en API key; commerciële integratie kan OAuth vereisen. Bevestig toegangsrechten en tarieven met Billit.
- Bewaar sandbox `BILLIT_SANDBOX_PARTY_ID`, `BILLIT_SANDBOX_API_KEY` uitsluitend als Worker secrets. **Deze bundel verzendt niets.** De bestaande EN16931/UBL-export blijft de veilige fallback totdat een geautoriseerde sandboxverzending, ontvangst en idempotente statusverwerking zijn gerealiseerd.
- https://docs.billit.be/docs/sandbox-vs-production-1 ; https://docs.billit.be/docs/partyid-and-key ; https://docs.billit.be/docs/send-ubl-to-peppol-1 .

### SumUp
- Maak een eigen **SumUp sandbox merchant** via het SumUp developer dashboard; kies read-only transactie-/settlementrechten voor de eerste synchronisatie.
- Server secrets: `SUMUP_API_KEY` en `SUMUP_MERCHANT_CODE` in main Worker. Instelling betekent nog geen echte aansluiting; eerst de sandbox-autorisatie, terugbetalingen, dubbele events en reconciliatie testen.
- De bestaande CSV-import en mapping via Administratie blijven beschikbaar. **Geen betalingen initiëren** zonder expliciete autorisatie.
- https://developer.sumup.com/api/ ; https://developer.sumup.com/tools/authorization/api-keys .

### Documenso
- Kies Documenso Cloud of aparte self-hosted Docker-hosting. Server secrets in main: `DOCUMENSO_BASE_URL` (HTTPS origin) en `DOCUMENSO_API_KEY` (privé token).
- De bestaande `lib/administration/documenso.ts` houdt verzending bewust uit. Voor productie nog vereist: werkende PDF-renderer, verzendactie met Head-Admin goedkeuring, webhook-signatuur, definitief archief en echte ondertekeningstest. Geen automatische contractverzending vóór acceptatie.
- https://docs.documenso.com/docs/developers/getting-started/first-api-call ; https://docs.documenso.com/docs/developers ; https://documenso.com/pricing .

### Bank
- Zonder externe kosten: gebruik de bestaande bankafschriftimport en afstemming. Voor **automatische** Belgische bankmutaties is Ponto (Isabel) een API-provider met echte bank-PSD2-toestemming.
- Voorbereidende naamgeving voor main Worker: `PONTO_CLIENT_ID`, `PONTO_CLIENT_SECRET`. Aangesloten credentials **zijn nog geen synchronisatie**: dit vereist account-/bankselectie via consent, tokenbeheer, deduplicatie, audit, periodieke herautorisatie en exact ledger-overzicht.
- Banklogin/wachtwoord mogen nooit in UpTillDawn, GitHub issues of secrets-documentatie worden geplakt. PSD2 toestemming verloopt bij de bank.
- https://pontosupport.isabel.eu/en-US/knowledgebase/article/KA-02515 ; https://dashboard.myponto.com .

### Te verifiëren voor gebruik
1. CI main en Deploy main groen op exacte nieuwe SHA; production CI/deploy niet gestart.
2. In een echte browser 4 locales, inkomcrew/revoked crew, niet-inkomwerkpost, onbekend event en onjuist origin testen.
3. Met officiële Weeztix testauth geldige/gebruikte/ongeldige barcode, verkeerd event, autorisatie, dubbele scans, traag/geen netwerk testen.
4. Vendor settings en betalingen zijn configuratie-readiness, geen bewijs van echte SumUp, Peppol, bank of Documenso transactie.


## Verbindingscontrole in de bestaande Admin → Platform-instellingen
Er is geen extra tab, snelkoppeling of dashboard toegevoegd. In de bestaande externe-dienstenlijst heeft SumUp, Documenso en Bank een knop **Verbinding testen**.
- De knop vraagt de server de credentials te controleren. De browser ziet uitsluitend `connected`, `not_configured`, `unauthorized` of `unavailable`, nooit tokens, bankgegevens of externe responsebodies.
- Alleen een geauthenticeerde, actieve hoofdadmin/maker met correcte origine kan de controller bereiken.
- **SumUp:** `GET https://api.sumup.com/v0.1/me` met server-only Bearer token, zonder verkoop of checkout.
- **Documenso:** `GET <DOCUMENSO_BASE_URL>/api/v2/envelope?perPage=1` met officiële API-key-Authorization, zonder contractsending of documentupload. Een werkende API betekent nog geen juridisch of operationeel geaccepteerde handtekeningworkflow.
- **Ponto:** `POST https://api.myponto.com/oauth2/token` met client_credentials. Dit is uitsluitend tokenuitgifte, geen bankkoppeling, PSD2-bankmachtiging, rekeningsynchronisatie of betaling.
- Een succesvolle test is **alleen een credentialtest** en schakelt geen geautomatiseerde providersync of real-money acties in. Ponto/Documenso/SumUp kunnen tarieven en toestemmingen vereisen.
- Zet geheimen alleen via Cloudflare → Workers & Pages → `uptilldawn-main` → Settings → Variables and Secrets; nooit in GitHub-broncode, screenshots of browser-URL's.
- Na het instellen en deployen van main kan de beheerder de knoppen gebruiken. Autorisatie en read-only test moeten apart via E2E worden gecontroleerd; deze code beweert geen echte providerverbinding zonder credentials.
- Controleer contractuele randvoorwaarden: https://developer.sumup.com/tools/authorization/api-keys/ ; https://openapi.documenso.com/ ; https://documentation.myponto.com/api/curl .


## 2026-11-09 — Beveiligde zelfbediening voor Hoofdadmin + Administratie
**Scope:** één UpTillDawn-organisatie, geen SaaS of multi-tenant accounts, geen nieuwe tabs of dubbele shortcuts. De bestaande gedeelde `ExternalServicesReadiness`-component op Admin → Platform en Administratie → Instellingen bevat één configuratieformulier. Bevoegdheid wordt op iedere aanvraag dubbel gecontroleerd: `administrationPageAccess` en de databasefunctie `upt_can_manage_administration`, inclusief een goedgekeurd, niet-geblokkeerd profiel.

### Eenmalige technische makerinstelling
Zet in de **main-test Cloudflare Worker** als *Secret*:
`UPT_INTEGRATION_ENCRYPTION_KEY` — exact 32 cryptografisch willekeurige bytes, als standaard Base64-string van 44 tekens, inclusief eventuele `=` aan het einde.
Genereer deze **lokaal** met:
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`
Voer de output uitsluitend in Cloudflare Workers → `uptilldawn-main` → Settings → Variables and Secrets → Secret in. Nooit in GitHub, een browsertest, SQL, logs of een ChatGPT-bericht. De key is verplicht voor het opslaan, lezen en testen van app-beheerde credentials. Maak een beveiligde backup buiten de app. Verlies ervan betekent dat reeds opgeslagen verbindingen niet meer ontsleuteld kunnen worden. **Gebruik een afzonderlijke sleutel voor production.**

### Wat Admin/Administratie zelf kunnen
- In de bestaande instellingen: **SumUp**, **Documenso Cloud**, **Ponto**, **Weeztix** of **Billit sandbox** selecteren.
- Geheime waarden invoeren en opslaan/vervangen; eerder opgeslagen geheimen worden **niet teruggetoond**.
- Via een bevestiging ontkoppelen. Secret ciphertext wordt dan verwijderd, auditmetadata blijft.
- SumUp, Documenso en Ponto via de bestaande knop *Verbinding testen* uitsluitend op credentials controleren.
- In beide portalen ziet iedereen dezelfde gedeelde verbindingen. Er worden geen nieuwe loginrollen of aparte organisatie-instellingen gemaakt.

### Veiligheidsmodel
- De hoofdapp versleutelt alle ingevulde credentials **vóór databaseopslag** met een Worker-only AES-256-GCM-key, willekeurige 96-bit nonce en providergebonden AAD. Versleutelde waarden staan uitsluitend in `upt_private.integration_connections`.
- `anon` en `authenticated` hebben **geen directe tabelrechten** en de tabellen zijn RLS-protected. Een allowlisted `public.upt_integration_credentials` RPC draait met expliciete controle op ingelogde gebruiker, goedgekeurd niet-geblokkeerd profiel en de geautoriseerde Administratierol.
- Bij connecteren, vervangen en ontkoppelen komt een entry in `upt_private.integration_connection_audit` met actie, tijdstip en verantwoordelijke. **Geen geheime waarde** komt in een auditentry.
- API-responses bevatten alleen opgeslagen status en tijdstip; RPC kan aan geautoriseerde gebruikers een **onleesbare AES-ciphertext** leveren, nooit de plaintext of de masterkey.
- CSRF-oppervlak: POST en DELETE eisen de bestaande strikte same-origin controle. Body- en veldlimieten voorkomen onbeperkte uploads. De Documenso-cloudorigin staat vast om SSRF via een door de gebruiker gekozen host te vermijden.
- Het systeem doet géén banktransacties, contractverzending, betalingen of Peppol-verzending door het opslaan alleen. Weeztix vergt nog servergestuurde automatische OAuth-verversing en een provider-bevestigde event-allowlist voordat echte entree op app-beheerde credentials kan draaien.
- Cloudmersive antivirus draait als centrale Supabase Edge-scanner, en blijft bewust door de Maker beheerd omdat een provider-token alleen geen scanneroperatie veilig activeert.

### Acceptatie en beperkingen
- Controleer de rollen Admin, Administratie, geblokkeerd, ingetrokken Administratie, gewone crew en anonieme requests. Verifieer daarnaast CSRF, invalid provider, overlong secrets, ongeldige URL, keyverlies, corrupte ciphertext, volledige verwijdering en audittrail. Alleen groene CI betekent **niet** automatisch gevalideerde provideroperaties.
- De huidige **credentialtest** (SumUp, Documenso, Ponto) kan app-opgeslagen sleutels lezen via de beveiligde serverroute. Productie-uitvoering van financiële acties vergt apart business approval, consent/scope, idempotentie en audit.
- Voor een toekomstige multi-tenant SaaS-installatie moet het single-organization schema eerst worden opgesplitst per organisatie; niet automatisch veronderstellen dat één globale providerkey voor meerdere klanten geschikt is.

### Verificatie en auditstatus (vervolgbundel)
- GET /api/administration/integrations geeft uitsluitend providerstatus, metadata en de 15 meest recente wijzigingsgebeurtenissen door via `upt_integration_audit_recent`. Geheime waarden en ciphertext worden niet teruggestuurd.
- De gebruikersinterface toont wie welke koppeling toevoegde, wijzigde of ontkoppelde; de RPC vereist op elk verzoek een goedgekeurde, niet-geblokkeerde Admin/Administratie-account.
- `secureStoreAvailable` betekent voortaan dat de Worker-secret de **juiste vorm** heeft: exact 32 bytes standaard-Base64. Alleen de aanwezigheid van een secret is niet genoeg. De API toont nooit de waarde.
- Main-deploy bevat een afzonderlijke unauthenticated smoke test voor de integratiebeheerroute. Een onverwachte 200 of 500 moet deployment blokkeren.
