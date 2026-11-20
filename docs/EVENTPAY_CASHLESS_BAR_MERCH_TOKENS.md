# EventPay Belgium — cashless Bar, Merch en Tokens (functionele en technische specificatie)
Status: vastgelegde gebruikerseis; **geen werkende live-betaalkoppeling**. Deze documentatie voegt geen productiesleutels, betaalacties of dubbele tabbladen toe. De betaalprovider is **EventPay BV, eventpay.be**, niet het gelijknamige Amerikaanse eventpay.com.

## Operationele uitgangssituatie
UpTillDawn gebruikt EventPay-RFID-kaarten met een QR-code. De kaart kan worden opgeladen aan een Token-/oplaadpunt en wordt gebruikt om drank en merch te betalen. Bar en Merch hebben hun eigen productmenu. EventPay is de **enige gezaghebbende bron** voor kaarttegoeden, walletmutaties, betaalbevestigingen en refunds. UpTillDawn is verantwoordelijk voor de crewplanning, werkpost, bevoegdheden, voorraad, rapportage en veilige synchronisatie. Maak geen extra eigen cashless-wallet of dubbele betaalverwerking.

## Bedieningsflows binnen de bestaande werkpost (geen nieuwe tab of snelkoppeling)
1. **Bar:** personeel meldt zich aan bij de toegewezen Bar-/Toog-werkpost; RFID-kaart via de door EventPay ondersteunde terminal of QR via camera scannen; EventPay-kaart/context valideren; toon de aan het event gekoppelde drankenlijst; kies product, aantal en eventuele statiegeld/bekerwaarborg; toon totaal; expliciete betaalbevestiging via **officiële EventPay-methode**; alleen bij een bevestigde providertransactie bon/voorraadmutatie en omzetregistratie. Geen saldo of 'betaald' op basis van alleen een gelezen QR.
2. **Merch:** zelfde flow, maar eigen productcatalogus, eventueel maat/kleur/variant; voorraad per variant; uitsluitend na bevestigde EventPay-transactie voorraad verlagen.
3. **Tokens / opladen:** scan of lees de kaart op de ondersteunde terminal; toon beschikbare EventPay-top-up-mogelijkheden; kies bedrag, laat EventPay het opladen en geldverkeer uitvoeren; **toon nieuw EventPay-saldo pas na echte bevestiging**. Geen lokale saldoverhoging.
4. Admin en Administratie kunnen binnen de **bestaande** event-/sales-/integratie-instellingen uitsluitend voor hun toegekende bevoegdheid het EventPay-event koppelen aan het UpTillDawn-event; menukaarten, prijzen, werkplekken, productvarianten, bekers en rapportage beheren. Geen duplicatie met andere modules.
5. Personeel heeft uitsluitend toegang tot zijn ingeplande post. Verantwoordelijke heeft inzicht in eigen post en toegewezen team; een cross-event/cross-stand walletmutatie is verboden.
6. Alle bestaande vier talen (NL/FR/EN/DE), GPS-/shift-/rolbevoegdheden en een werkbare camerafallback blijven verplicht.

## Systeemgrenzen, geld en boekhouding
- **Top-up is geen verkoop van consumpties** en mag **niet opnieuw als omzet worden opgeteld** bij latere bar/merch-betalingen. Financiële reconciliatie maakt onderscheid tussen opgeladen klanttegoed/verplichting, betaalde consumpties, terugbetalingen, chargebacks, vergoedingen en uitbetalingen door EventPay.
- De huidige UpTillDawn-transactiefunctie `upt_sales_record` accepteert een gebruikerkeuze 'cash' of 'card' zonder extern betaalbewijs. **Niet gebruiken om een EventPay-transactie te bevestigen of saldo af te boeken**. Een eventuele bestaande handmatige registratie mag niet worden vermengd met EventPay-geldstromen.
- Gebruik per betaling een unieke providertransactie-ID, event-ID, werkplek-ID en unieke idempotency-/orderreferentie; bij dubbele callback/webhook nooit een tweede afboeking of voorraadmutatie. Controleer bedrag, valuta EUR, status, catalogusprijs en eventbinding vóór afhandeling.
- Geen afschrijving bij timeout, offline of onbekende providerstatus; status = **onzeker**, veilig heropvragen/reconciliëren. EventPay heeft mogelijk eigen offlineprocedures: die mogen niet door een lokale UpTillDawn-QR-acceptatie worden nagebootst.
- Refunds via officiële EventPay-terugboeking met afzonderlijke gebeurtenis, audit trail en beperkte rechten. Saldo- en transactiegegevens nooit als vrij bewerkbare adminvelden.
- Kaart-QR/RFID-inhoud kan een identificator of gevoelige bearer-code zijn. Niet loggen, niet in URLs met analytics, niet in meldingen/chats, niet als platte tekst in database. Alleen tokenized/geverifieerde providerreferentie bewaren voor noodzakelijke reconciliatie.
- Bij ontbrekende leverancierkoppeling: verkoop en herladen gebeurt op de **EventPay-terminal/app**; de UpTillDawn-app mag alleen statusinformatie weergeven die aantoonbaar uit gesynchroniseerde providergegevens komt.

## Technische verificatie vóór implementatie en activatie
1. Officiële EventPay-documentatie of partnercontract verkrijgen voor: card/wallet lookup, top-up, order/charge, refunds, webhooks of transactie-export, productcatalogus, btw/bekers en offline-afhandeling. De publieke API wordt op `docs.eventpay.be` vermeld, maar de specifieke endpoints, credentials en toegang zijn nog **niet geverifieerd**. **Geen endpoints verzinnen**.
2. Verifiëren of de QR en RFID van dezelfde fysieke kaart via een door EventPay ondersteunde canonical wallet-ID gekoppeld kunnen worden. Niet aannemen dat de twee codes identiek zijn of dat generieke Web NFC iOS ondersteunt.
3. Rol- en shift-gebaseerde autorisatie, externe-eventmapping en zowel Admin als Administratie bevoegde configuratierechten (zonder zelfkeurige betaling).
4. Gecertificeerde reader-/POS-ondersteuning: QR-camera in PWA; RFID via officiële EventPay-reader/terminal of formeel ondersteunde hardware. iOS Safari biedt geen Web NFC en de meeste RFID-betaalkaarten zijn geen algemene NDEF-tags.
5. E2E-sandbox: geldige/onbekende/geroofde kaart, onvoldoende saldo, dubbele scan, dubbele bevestiging, verloren netwerk, timeout na daadwerkelijke betaling, refund, andere werkpost/event, prijswijziging, bekerwaarborg, gesynchroniseerde voorraad en finance. **Geen echte kaart/saldo gebruiken voor tests**.
6. Geen live-betalingen zonder succesvolle provider-test en autorisatie. Hoofdadmin en Administratie mogen de bestaande integraties/configuratie beheren conform hun huidige rechten; productie pas via de afzonderlijke expliciete releaseprocedure.

## Referenties
- https://eventpay.be/oplossingen/
- https://eventpay.be/oplossingen/eventapp/
- https://eventpay.be/integraties/
- https://eventpay.be/responsible-disclosure/ (vermeldt openbare EventPay API en docs.eventpay.be)
- https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API

## Open afhankelijkheid
De werkelijk werkende in-app betaalactie vergt ondersteunde EventPay-API-/POS-integratierechten plus testtoegang. Tot dan is dit een **specificatie**, niet een werkende betaalterminal. De financiële, kaart- en rolvalidatie mogen niet worden omzeild om een gesimuleerde 'verkoop geslaagd'-melding te tonen.
