# Main E2E-bots — feitelijke status en installatie

Main-testdatabase 13 november 2026: slechts drie E2E-accounts: `e2e-admin@uptilldawn.test` is **Linkerhand** + Administratie en **geen** Hoofdadmin; `e2e-responsible@uptilldawn.test` is Verantwoordelijke; `e2e-staff@uptilldawn.test` is Personeel. De Head- en Right-hand-slots zijn leeg.

Het bestaande, afgeschermde provisioning-script maakt na expliciete start precies zeven **operationele** accounts bruikbaar: Hoofdadmin, Linkerhand, Rechterhand, Verantwoordelijke, Personeel, Promotie en Administratie. Bestaande accounts worden hergebruikt en onder hun correcte naam gepresenteerd. Beide deputies krijgen een eigen Administration-toewijzing; Hoofdadmin krijgt de Head-slot. Geen bestaande bezette menselijke leiderschapsslot wordt overschreven.

**Maker/God Mode** is een achtste, **tijdelijke en niet-persistente** E2E-identiteit voor de geïsoleerde lokale CI-database (`scripts/seed-local-maker-e2e.mjs`, `scripts/god-mode-maker-e2e.mjs`). De gewone Main-testomgeving krijgt geen tweede permanent Owner-account: echte Maker-rechten geven potentieel toegang tot GitHub en andere beheerfuncties.

## Uitvoeren zonder extra workflow

Binnen het bestaande [Deploy main-workflow](https://github.com/denkyaan/UpTillDawn-Crew/actions/workflows/deploy-main.yml) is een aparte optionele, handmatige **provision-qa-bots**-job toegevoegd. Die job start **geen deploy en geen productie-CI**.

Vereiste **GitHub Actions repository secrets**, uitsluitend voor het Main-testproject `npbjrtiolqperdgljnhi`:
- `MAIN_QA_SUPABASE_SECRET_KEY`: private Supabase Auth Admin / service-role secret van Main-test, nooit productie.
- `MAIN_QA_BOT_PASSWORD`: testwachtwoord van minimaal 24 tekens voor **nieuw** gemaakte QA-accounts (bestaande wachtwoorden blijven behouden).

Ga naar het genoemde workflow, kies **Run workflow** op branch **main** en zet `provision_qa_bots=true`. De job gebruikt `supabase.auth.admin.createUser` (geen directe SQL in `auth.users`), controleert rollen/slotconflicten vóór wijzigingen en verifieert de echte zeven Auth-identiteiten na uitvoering. De workflow faalt expliciet als geheimen of rollen ontbreken; groen CI Main op code alleen is **geen** bewijs dat Main-accounts bestaan.

De zesrollenbrowser-E2E en externe leveranciersacceptatie blijven aparte tests. Een Main Maker-bot met permanente Owner-rechten wordt niet stilzwijgend aangemaakt.
