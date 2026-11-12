# God Mode App Studio

Open `/maker-mode` after signing in with the permanent Maker/Owner identity and choose God Mode. This creates a private two-hour God Mode session on the current environment; a main-test session does not grant production access. God Mode is not an operational Head Admin role.

## Maker workflow and environments

The main menu groups the existing tools into **Overzicht**, **AI & herstel**, **App Studio**, **Versies & CI**, and **Geavanceerd**. The environment selector shows `main` (test) and `production` (live). Status information and registered application/error/recovery/audit logs are kept separate by Supabase project. Switching to edit an environment opens that environment's own authenticated God Mode; no JWT is forwarded between projects. Cross-project diagnostic queries through a connected Supabase Management token are read-only. Production live-revision SHA is not asserted unless deployment evidence confirms it.

Cloudflare Workers Observability log queries are available in **Systeemlogs** after configuring the separate `CLOUDFLARE_OBSERVABILITY_CONFIG` secret on the Main Worker. Without this opt-in secret, God Mode truthfully reports that Cloudflare runtime logs are unavailable; only persisted application logs and authorized Supabase platform logs are visible. Provider limits still apply to AI context, tokens, latency and billing; the assistant must not claim unlimited resources or silent production self-repair.

## Tools

- **Programmering:** browse repository text files, edit TypeScript/React/SQL/configuration, create and delete files, compare changes, import/export drafts, search/replace, undo/redo, format and insert a working button template.
- **Knoppen & onderdelen:** searchable build-generated index of JSX controls and exported functions. Open a component at its source line. Same-origin page inspection captures clicks to locate matching source; it uses the current ordinary app session and does not impersonate staff.
- **AI-programmeur:** proposes complete source changes using the selected and changed files. Proposals stay in a draft until reviewed and saved. It cannot silently publish or run SQL.
- **Gegevens:** inspect all application tables in `public`, insert records and edit/delete rows with primary keys. Writes are immediate, checked against the complete original row, and recorded in `upt_private.god_data_audit`. Cascaded deletions are governed by existing database constraints.
- **Logica & workflows:** SQL workbench with templates for functions, triggers, scheduled jobs and the God Mode data audit. Starts read-only. Writes require explicit confirmation for the current query. SQL execution does not automatically create a repository migration; retain schema changes as new migration files.
- **Rollen & navigatie:** existing role rule and layout editor.
- **Versies & publicatie:** each code change creates a `god-mode/*` branch and pull request. The specific revision must pass the `ci.yml` workflow and include current main before it can be merged. CI main verifies the exact proposal revision. A merged revision goes through Deploy main to update **main-test only**. Production CI and Deploy production are separate, explicit release actions and are never triggered by simply publishing in God Mode. A merge is not deployment success. Source restoration creates a new reviewed change and does not restore database data.

## One-time connections

ChatGPT's GitHub/Supabase connector sessions cannot be transferred to a deployed website.

1. Under **Koppelingen**, provide a fine-grained GitHub token scoped to `denkyaan/UpTillDawn-Crew`. Required read/write permissions: Contents, Pull requests, Actions and Workflows (for editing workflow files). God Mode checks repository push access before storing it.
2. For advanced SQL and cross-environment log inspection, connect a Supabase Management API token with permissions for the specific selected project(s). Main-test is `npbjrtiolqperdgljnhi`; production is `eakoavcieossazqzplke`. Tokens are stored server-side, not in browser storage. Production writes are allowed only from an authenticated production God Mode session with an additional typed `PRODUCTION` confirmation. Ordinary data editing uses the current environment's God Mode session.

Credentials are encrypted in Supabase Vault, never written to GitHub or browser storage, and can be disconnected. Every retrieval and modification RPC checks the private expiring God Mode session. HTTP routes additionally reject cross-site requests and use no-store responses. The public RPC grants support the dedicated God Mode cookie authentication, not anonymous access: absent/invalid/expired God tokens are rejected.

## Error-AI: bewijs vóór afsluiten

Een AI-diagnose is nooit gelijk aan bewezen herstel. In **AI & herstel** verschijnen open incidenten op ernst en herhaling, inclusief een foutmelding als logs niet kunnen worden opgehaald. Het AI-herstelvoorstel beschouwt foutteksten en eerdere modelantwoorden als onbetrouwbare gegevens; het voert daarin geen instructies uit.

Een Maker kan een incident alleen afsluiten via **Herstel controleren** na het daadwerkelijk herhalen van de fouttest. Verplicht: een concrete beschrijving van minstens 30 tekens en de volledige commit-SHA van een succesvolle, actuele deployment in dezelfde omgeving, die niet ouder is dan het oorspronkelijke incident. Voor productie moet ook de `production-current`-tag overeenkomen. Het controleerbare deploymentrun-ID wordt toegevoegd aan de notitie. Zonder bewijs blijft de fout open.

**Let op:** een succesvolle deployment bewijst op zichzelf nog niet dat die specifieke fout is verholpen. De Maker moet de reproductiestappen werkelijk opnieuw uitvoeren; automatische reparatie en productiepublicatie worden niet gesuggereerd als ze niet zijn uitgevoerd.

## Platformlogs en externe verbinding

Main schakelt Cloudflare Workers invocation logging expliciet in. God Mode kan via het bestaande **Systeemlogs**-scherm ook een server-side, strikt begrensde Cloudflare Workers Observability-query uitvoeren voor `uptilldawn-main` of `uptilldawn-crew`. De API accepteert uitsluitend een geldige Maker-sessie, geeft geen ander Worker's logs door, en schrijft niets naar Cloudflare. Zonder Cloudflare-verbinding toont de app een expliciete waarschuwing en blijft de bestaande Supabase-/applogweergave bruikbaar.

**Eenmalige koppeling:** maak bij Cloudflare een specifiek token met alleen de voor Workers Observability-query vereiste permissie (de Cloudflare API noemt dit `Workers Observability Write`; geef geen Workers Scripts- of deploymentrechten). Voeg in Cloudflare Workers & Pages → **uptilldawn-main** → **Settings** → **Variables and Secrets** één versleuteld Worker-secret toe met naam `CLOUDFLARE_OBSERVABILITY_CONFIG` en JSON-inhoud `{"accountId":"<Cloudflare-account-ID>","token":"<specifiek-Observability-token>"}`. Gebruik dus nooit het algemene `CLOUDFLARE_API_TOKEN` uit de CI. De CI-workflow heeft bewust geen secret-schrijfbevoegdheid en past dit niet zelf aan. De read-only logviewer is technisch voorbereid, maar echte Cloudflare-logresultaten zijn pas bewezen na koppeling en live controle. Een wijziging voor productie blijft afzonderlijk goed te keuren.

## Limits and recovery

The code editor edits text source; binary files are not treated as text. A changeset supports up to 30 files and 1.5 MB combined text. AI context is smaller and may require several focused requests. A new button's event handler must run in a client component, or use an appropriate server action.

Unsaved drafts stay in the current tab's memory. Export a draft before leaving; imports require the same repository base revision. Existing committed source history remains available through GitHub even if a source change removes the studio itself. SQL writes and cascaded data deletions require their own database recovery plan; restoring a source version does not undo them.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build:cloudflare`, and `npx wrangler deploy --dry-run`.

`tests/sql/god-mode-source-studio.sql` verifies rejected invalid sessions, safe table identifiers, insert/update/delete, stale-write rejection, primary-key-scoped deletion and audit entries. All fixtures are rolled back.
