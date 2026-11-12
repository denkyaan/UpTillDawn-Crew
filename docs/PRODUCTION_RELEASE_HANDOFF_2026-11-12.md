# UpTillDawn — productie-release, 12 november 2026

**Autorisatie:** de eigenaar heeft expliciet verzocht om de huidige afwerkingsbundel naar productie te brengen na succesvolle controles.

**Releasecode:** de gevalideerde `main`-snapshot van de eisencontrole (PR met 18 kritieke schema-contracten, 76 vereiste kolommen). De release-commit zelf voegt alleen deze handoffnotitie toe en wijzigt geen applicatielogica.

## Harde releasevoorwaarden

1. Snelle Main-CI groen op de release-SHA; geen automatische productie-CI via gewone Main-commits.
2. **CI production** expliciet activeren via de release-marker, en de volledige geïsoleerde migratie-, SQL-, PWA-, browser- en securitysuite op exact dezelfde SHA uitvoeren.
3. **Deploy production** uitsluitend automatisch na geslaagde CI production, met vastgepinde SHA, bestaande production Supabase-URL, migratiecontract, noodzakelijke secrets, Worker-bundle-dry-run, RPC-contract en HTTP-smoke.
4. Na de uitrol `production-current`, echte login, rolbeveiliging, RLS en app-fouten controleren. Geen fictieve succesmelding wanneer een externe dienst niet is getest.
5. Indien enig van deze controles faalt: release **niet als voltooid markeren**. De laatst functionerende production Worker blijft zo lang mogelijk onaangeroerd; werk daarna aan de precieze blokkade.

## Duidelijke functiestatus

- Main heeft een geteste Maker/God Mode, zes rolportalen, teamplanning, briefings, personeelsbeheer, administratieve workflows, scanner- en betalingssysteem-integratievoorbereiding.
- **EventPay:** alleen import en reconciliatie van externe afrekeningen; rechtstreekse RFID/QR-betalingen, kaartoplading en automatische walletmutaties zijn **niet geïmplementeerd** en mogen niet als live-functie worden aangekondigd. Tot officiële EventPay-API/POS-sandboxtoegang is bevestigd, gebeurt betaling uitsluitend via EventPay-terminals/-app.
- De live onafhankelijke zes-rol-browser-QA op de gedeployde Worker en de externe dienstacceptatie blijven afzonderlijke bewijslagen. De geïsoleerde CI-proeven vervangen die niet.
- Geen wijzigingen aan productie-accounts, betalingstransacties of database via dit document.

## Veilige opvolging

Gebruik de bestaande vijf GitHub Workflows. Controleer het workflow-run-ID, de `production-current`-tag en de feitelijke loginapp na een geslaagde release; verzamel geen credentials of betaalkaartgegevens in Actions-logs.
