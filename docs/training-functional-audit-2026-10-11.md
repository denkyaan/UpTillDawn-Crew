# UpTillDawn Crew — inhoudelijke rolaudit

**Auditdatum:** 11 oktober 2026  
**Werkbranch:** `rebuild/interactive-role-training` · **PR #19 (concept)**  
**Reikwijdte:** code, route-mapping, oefencatalogus en geautomatiseerde tests; geen productie-release

## Aanvaardingsnorm

Een trainingsstap is pas werkelijk interactief als de gebruiker een **domeinspecifieke functie** in de fictieve app uitvoert, invoer- en rolbeperkingen gelden, de gevolgen zichtbaar worden in een gedeelde fictieve toestand, en de stap uitsluitend na dat echte resultaat voortgang krijgt. Een generiek invulveld of checkbox in `RoleTrainingLab` telt **niet** als voldoende implementatie van de bijbehorende productfunctie.

De vier talen **NL/FR/EN/DE**, zelf klikken op de navigatietab, uitsluitend paarse actieknoppen, geen schermdimming, rolgebonden rechten en geen productie-schrijfacties zijn verplichte randvoorwaarden.

## Inhoudelijke codecontrole

| Hoofdstuk | Rol | Vastgestelde status van praktische bediening |
|---|---|---|
| Personeel / Goedkeuringen | Admin, waar van toepassing | Eigen stateful personeelsdemo; verdere vergelijking met alle productieknoppen nodig |
| Chats | Alle rollen | Eigen stateful bericht-, reactie- en deelnemerdemo |
| Instellingen / Help | Alle rollen | Eigen interactieve demoschermen |
| Excel / Platformbeheer | Admin | Eigen interactieve demoschermen |
| Driver / afsluitende urenstaat | Relevante rollen | Eigen stateful demohandelingen |
| Sales | Admin | Nieuw: negen handelingen met boeken van verkoop, balans en rapport; valideren met CI |
| Incidenten | Alle rollen | Nieuw: intake, urgentie, locatie, escalatie, antwoord en sluiting; valideren met CI |
| Inventaris | Alle rollen | Nieuw: materiaalaantallen, staat, tekorten, documenten, wekelijkse controle, opstart/afsluit; valideren met CI |
| Guestlist / Backstage | Alle rollen | Nieuw: zoeken, spots, aankomst, import en Backstage-notificatie; valideren met CI |
| Overzicht | Alle rollen | **Onvolledig**: meerdere informatie- en onboardingstappen gebruiken de generieke oefenkaart |
| Evenementen | Alle rollen | **Onvolledig**: slechts enkele stappen gebruiken echte eventknoppen; beschikbaarheid en de volledige admin-eventcyclus nog verder omzetten |
| Werkplekken / Shifts | Alle rollen | **Onvolledig**: echte bediening aanwezig voor een deel van de stappen; overig nog generieke acties |
| Briefing | Alle rollen | **Gedeeltelijk**: openen, lezen en bevestigen zijn actief, maar niet elke admin-/verantwoordelijkefunctie |
| Werkuren tijdens de shift | Alle rollen | **Gedeeltelijk**: aanwijzing en Start Work via echte UI; extra operationele stappen deels generiek |
| Taken | Alle rollen | **Gedeeltelijk**: taak openen en voltooien werken in de demo; overige aanmaak-, toewijzings- en verantwoordelijkeacties nog generiek |

### Belangrijke interpretatie van de 15 bots

Er zijn **15 geauthenticeerde browseractors**, maar in `scripts/15-bot-browser-test.mjs` doorlopen alleen de eerste vier (`index<4`) alle trainingshoofdstukken integraal. De overige actors testen vooral authenticatie, routes en operationele deelstromen. De uitspraak ‘15 bots geslaagd’ is dus **geen bewijs dat alle 15 bots elk hoofdstuk en elk edge case hebben getest**.

### Nog te toetsen vóór een definitieve release

1. Vervang alle overblijvende generieke oefenstappen door echte componenthandelingen; laat de browserbot de fictieve status en roltoestemming per stap controleren.
2. Test alle rolvarianten, inclusief Driver, Backstage, Entrance/Guestlist, Bar/Toog, Merch en Tokens, met realistische shifts en inventaris.
3. Vergelijk **iedere zichtbare productieknop** met de catalogus, inclusief foutpaden, status- en toegangsvoorwaarden, niet uitsluitend catalogusstappen met een bestaand UI-element.
4. Voer een runtime-taalaudit van volledige schermen en demo-instructies uit op iOS-/Android-/desktopformaten; nieuwe tekst moet in vier talen bestaan.
5. Verifieer dat het einde van de rondleiding pas mogelijk is na alle eerdere hoofdstukken en dat geen automatische tabnavigatie of generieke vervangactie gebruikt wordt.
6. Valideer opnieuw na een volledige groene CI met alle geïsoleerde migraties, beide builds en het browser-botpakket.

**Conclusie:** de rondleiding wordt aantoonbaar uitgebreider, maar is zolang de hoofdstukken hierboven onvolledig zijn **niet 100% inhoudelijk af**. Laat PR #19 concept en publiceer de trainingsbranch niet naar productie uitsluitend op basis van een groene CI.
