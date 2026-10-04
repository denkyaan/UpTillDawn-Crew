"use client"

import {useEffect,useMemo,useState} from "react"
import {usePathname,useRouter} from "next/navigation"
import {useAuth,type UiRole} from "@/lib/providers"
import {createClient} from "@/lib/supabase/crew-client"
import {translateRuntimeUi} from "@/lib/ui-translation-runtime"
import {featureHelp} from "@/lib/ui-field-help"
import {parseUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"
import type {ExtendedUiLocale} from "@/lib/ui-translation-extensions"

type TourText={nl:string;en:string;fr:string;de:string}
type Copy=string|TourText
type Detail={heading:Copy;body:Copy;selector:string}
type Step={heading:Copy;body:Copy;selector:string;route?:string;inside?:Detail[]}

const c=(nl:string,en:string,fr:string,de:string):TourText=>({nl,en,fr,de})

const UI_COPY={
  promptTitle:c("Welkom bij Up Till Dawn Crew","Welcome to Up Till Dawn Crew","Bienvenue dans Up Till Dawn Crew","Willkommen bei Up Till Dawn Crew"),
  promptBody:c("Start de interactieve rondleiding. Elke tab wordt echt geopend en binnen elke tab krijg je uitleg over wat je ziet en hoe je de functies gebruikt.","Start the interactive tour. Every tab is opened for real, and inside each tab you get an explanation of what you see and how to use its functions.","Démarrez la visite interactive. Chaque onglet est réellement ouvert et, dans chaque onglet, vous recevez une explication de ce que vous voyez et de la façon d’utiliser les fonctions.","Starte die interaktive Führung. Jeder Tab wird tatsächlich geöffnet, und in jedem Tab wird erklärt, was du siehst und wie du die Funktionen verwendest."),
  tour:c("Rondleiding","Tour","Visite","Rundgang"),
  start:c("START RONDLEIDING","START TOUR","COMMENCER LA VISITE","RUNDGANG STARTEN"),
  later:c("LATER","LATER","PLUS TARD","SPÄTER"),
  skip:c("OVERSLAAN","SKIP","PASSER","ÜBERSPRINGEN"),
  back:c("VORIGE","BACK","PRÉCÉDENT","ZURÜCK"),
  next:c("VOLGENDE","NEXT","SUIVANT","WEITER"),
  done:c("KLAAR","DONE","TERMINÉ","FERTIG"),
  what:c("Wat vind je in deze tab?","What is in this tab?","Que contient cet onglet ?","Was findest du in diesem Tab?"),
  how:c("Hoe gebruik je deze tab?","How do you use this tab?","Comment utiliser cet onglet ?","Wie benutzt du diesen Tab?"),
}

const WELCOME:Record<UiRole,{heading:TourText;body:TourText}>={
  employee:{
    heading:c("Welkom, personeel","Welcome, staff","Bienvenue, personnel","Willkommen, Personal"),
    body:c("We lopen door de volledige personeelsapp. Ook event- en shiftgebonden tabs worden tijdens de rondleiding tijdelijk zichtbaar als preview.","We go through the complete staff app. Event- and shift-dependent tabs are also temporarily visible as a preview during the tour.","Nous parcourons toute l’application du personnel. Les onglets liés aux événements et aux shifts sont aussi temporairement visibles en aperçu pendant la visite.","Wir gehen durch die komplette Personal-App. Event- und schichtabhängige Tabs werden während der Führung ebenfalls vorübergehend als Vorschau sichtbar."),
  },
  responsible_lead:{
    heading:c("Welkom, verantwoordelijke","Welcome, responsible lead","Bienvenue, responsable","Willkommen, Verantwortliche/r"),
    body:c("We lopen door de volledige app voor Verantwoordelijke. De rondleiding opent elke tab en toont ook functies die normaal pas bij een toegewezen evenement of actieve shift verschijnen.","We go through the complete Responsible Lead app. The tour opens every tab and also shows features that normally only appear for an assigned event or active shift.","Nous parcourons toute l’application Responsable. La visite ouvre chaque onglet et affiche aussi les fonctions qui n’apparaissent normalement qu’avec un événement attribué ou un shift actif.","Wir gehen durch die komplette App für Verantwortliche. Die Führung öffnet jeden Tab und zeigt auch Funktionen, die normalerweise erst bei einem zugewiesenen Event oder einer aktiven Schicht erscheinen."),
  },
  admin:{
    heading:c("Welkom in Admin","Welcome to Admin","Bienvenue dans Admin","Willkommen im Adminbereich"),
    body:c("We lopen door de volledige Admin-omgeving. Elke beheertab wordt geopend en binnen de tab leggen we de belangrijkste functies en workflow uit.","We go through the complete Admin environment. Every management tab is opened and the main functions and workflow are explained inside it.","Nous parcourons tout l’environnement Admin. Chaque onglet de gestion est ouvert et les principales fonctions et le workflow y sont expliqués.","Wir gehen durch die komplette Admin-Umgebung. Jeder Verwaltungs-Tab wird geöffnet und die wichtigsten Funktionen und Abläufe werden darin erklärt."),
  },
}

const GENERIC_HOW=c(
  "Gebruik de zichtbare velden en acties volgens je rol. De rondleiding voert zelf geen wijzigingen uit.",
  "Use the visible fields and actions according to your role. The tour itself never changes data.",
  "Utilisez les champs et actions visibles selon votre rôle. La visite elle-même ne modifie aucune donnée.",
  "Verwende die sichtbaren Felder und Aktionen entsprechend deiner Rolle. Die Führung selbst ändert keine Daten."
)

const HOW_COPY:Record<UiRole,Record<string,TourText>>={
  employee:{
    overview:c("Controleer hier eerst je huidige evenement, dienst, werkplekstatus en directe vervolgstappen.","Start here to check your current event, shift, workplace status and direct next actions.","Commencez ici pour vérifier votre événement actuel, votre shift, le statut du poste et les prochaines actions.","Prüfe hier zuerst dein aktuelles Event, deine Schicht, den Arbeitsplatzstatus und die nächsten Aktionen."),
    events:c("Open een evenement en geef vóór de deadline IK KAN of IK KAN NIET door. Geef ook je beschikbaarheid voor opbouw en afbouw door wanneer die gevraagd wordt.","Open an event and submit I CAN or I CANNOT before the deadline. Also provide setup and teardown availability when requested.","Ouvrez un événement et indiquez JE PEUX ou JE NE PEUX PAS avant la date limite. Indiquez aussi votre disponibilité pour le montage et le démontage si demandé.","Öffne ein Event und gib vor der Frist ICH KANN oder ICH KANN NICHT an. Gib bei Bedarf auch deine Verfügbarkeit für Auf- und Abbau an."),
    operations:c("Gebruik dit voor je eigen check-in/out, werkstart, pauze en werkstop. Volg steeds de bevestigingsflow van de verantwoordelijke wanneer die vereist is.","Use this for your own check-in/out, work start, break and work stop. Follow the responsible lead confirmation flow whenever required.","Utilisez ceci pour votre propre check-in/out, début de travail, pause et fin de travail. Suivez toujours le flux de confirmation du responsable lorsqu’il est requis.","Verwende dies für deinen eigenen Check-in/out, Arbeitsstart, Pause und Arbeitsende. Folge immer dem Bestätigungsablauf des Verantwortlichen, wenn er erforderlich ist."),
    workplaces:c("Bekijk waar je bent ingepland, je shifturen, je werkplek en wie er met jou werkt. Je wijzigt de planning hier niet zelf.","See where you are scheduled, your shift hours, your workplace and who works with you. You do not change the planning yourself here.","Consultez votre planning, vos heures de shift, votre poste et les collègues présents. Vous ne modifiez pas vous-même le planning ici.","Sieh, wo du eingeplant bist, deine Schichtzeiten, deinen Arbeitsplatz und wer mit dir arbeitet. Die Planung änderst du hier nicht selbst."),
    inventory:c("Controleer het materiaal van je toegewezen werkplek. Meld ontbrekend of defect materiaal wanneer die actie voor jouw rol beschikbaar is.","Check the equipment for your assigned workplace. Report missing or defective items when that action is available to your role.","Contrôlez le matériel de votre poste attribué. Signalez le matériel manquant ou défectueux lorsque cette action est disponible pour votre rôle.","Prüfe das Material deines zugewiesenen Arbeitsplatzes. Melde fehlendes oder defektes Material, wenn diese Aktion für deine Rolle verfügbar ist."),
    guestlist:c("Wanneer je aan Inkom werkt, zoek je gasten of artiesten op, controleer je hun gegevens en registreer je hun aankomst volgens de checklist.","When you work at Entrance, search for guests or artists, verify their details and register their arrival using the checklist.","Lorsque vous travaillez à l’entrée, recherchez les invités ou artistes, vérifiez leurs données et enregistrez leur arrivée via la checklist.","Wenn du am Eingang arbeitest, suchst du Gäste oder Künstler, prüfst ihre Angaben und registrierst ihre Ankunft über die Checkliste."),
    sales:c("Registreer alleen verkopen wanneer verkoop voor jouw werkplek actief is. Kies het juiste item, aantal en betaalmethode en controleer de bevestiging.","Only register sales when sales is active for your workplace. Choose the correct item, quantity and payment method and verify the confirmation.","Enregistrez uniquement les ventes lorsque la vente est active pour votre poste. Choisissez l’article, la quantité et le moyen de paiement corrects et vérifiez la confirmation.","Erfasse Verkäufe nur, wenn der Verkauf für deinen Arbeitsplatz aktiv ist. Wähle Artikel, Menge und Zahlungsmethode korrekt und prüfe die Bestätigung."),
    briefings:c("Lees alle event- en werkplekinstructies vóór je shift en bevestig de briefing pas nadat je ze volledig hebt gelezen.","Read all event and workplace instructions before your shift and only confirm the briefing after reading them completely.","Lisez toutes les instructions de l’événement et du poste avant votre shift et ne confirmez le briefing qu’après lecture complète.","Lies alle Event- und Arbeitsplatzanweisungen vor deiner Schicht und bestätige das Briefing erst nach vollständigem Lesen."),
    tasks:c("Open je toegewezen taken, lees omschrijving en deadline en werk de status bij wanneer je begint of afrondt.","Open your assigned tasks, read the description and deadline, and update the status when you start or finish.","Ouvrez vos tâches attribuées, lisez la description et l’échéance, puis mettez le statut à jour au début et à la fin.","Öffne deine zugewiesenen Aufgaben, lies Beschreibung und Frist und aktualisiere den Status beim Start und Abschluss."),
    chat:c("Kies het juiste organisatie-, event- of werkplekkanaal en gebruik de chat voor operationele communicatie met de crew.","Choose the correct organisation, event or workplace channel and use chat for operational communication with the crew.","Choisissez le bon canal organisation, événement ou poste et utilisez le chat pour la communication opérationnelle avec l’équipe.","Wähle den richtigen Organisations-, Event- oder Arbeitsplatzkanal und nutze den Chat für die operative Kommunikation mit der Crew."),
    crew:c("Bekijk hier de personeelsinformatie die voor jouw rol zichtbaar is, bijvoorbeeld wie aan dezelfde werkplek gekoppeld is.","View the personnel information available to your role here, such as who is linked to the same workplace.","Consultez ici les informations du personnel disponibles pour votre rôle, par exemple les personnes liées au même poste.","Sieh hier die Personalinformationen ein, die für deine Rolle sichtbar sind, zum Beispiel wer demselben Arbeitsplatz zugeordnet ist."),
    incidents:c("Tijdens een actieve shift meld je hier hulpvragen of incidenten. Gebruik urgent alleen voor echte operationele urgentie; locatie kan bij die flow worden meegestuurd.","During an active shift, report help requests or incidents here. Use urgent only for real operational urgency; location may be included in that flow.","Pendant un shift actif, signalez ici les demandes d’aide ou incidents. Utilisez l’urgence uniquement pour une vraie urgence opérationnelle ; la localisation peut être transmise dans ce flux.","Während einer aktiven Schicht meldest du hier Hilfeanfragen oder Vorfälle. Nutze dringend nur bei echter operativer Dringlichkeit; der Standort kann dabei übermittelt werden."),
    settings:c("Werk je profiel bij, kies je taal en start de rondleiding opnieuw wanneer je uitleg wilt herbekijken.","Update your profile, choose your language and restart the tour whenever you want to review the explanation.","Mettez votre profil à jour, choisissez votre langue et relancez la visite lorsque vous souhaitez revoir les explications.","Aktualisiere dein Profil, wähle deine Sprache und starte die Führung neu, wenn du die Erklärungen erneut sehen möchtest."),
  },
  responsible_lead:{
    overview:c("Gebruik het overzicht om je eigen status én de bezetting, status en lopende werk- of pauzetimers van je werkplek te volgen.","Use the overview to follow your own status plus the staffing, status and running work or break timers for your workplace.","Utilisez l’aperçu pour suivre votre propre statut ainsi que l’effectif, le statut et les chronomètres de travail ou de pause de votre poste.","Nutze die Übersicht, um deinen eigenen Status sowie Besetzung, Status und laufende Arbeits- oder Pausentimer deines Arbeitsplatzes zu verfolgen."),
    events:c("Controleer de evenementen waarvoor je bent ingezet, beschikbaarheid en relevante planning. Je beheert alleen de scope die aan jou is toegewezen.","Check the events you are assigned to, availability and relevant planning. You only manage the scope assigned to you.","Contrôlez les événements auxquels vous êtes affecté, la disponibilité et le planning pertinent. Vous ne gérez que le périmètre qui vous est attribué.","Prüfe die Events, denen du zugewiesen bist, die Verfügbarkeit und die relevante Planung. Du verwaltest nur deinen zugewiesenen Bereich."),
    operations:c("Registreer je eigen werkuren en behandel de check-in- of remote aanvragen waarvoor jij verantwoordelijk bent. Volg correcties en bevestigingen binnen je werkplek.","Record your own work hours and handle the check-in or remote requests you are responsible for. Follow corrections and confirmations within your workplace.","Enregistrez vos propres heures et traitez les demandes de check-in ou à distance dont vous êtes responsable. Suivez les corrections et confirmations de votre poste.","Erfasse deine eigenen Arbeitszeiten und bearbeite Check-in- oder Remote-Anfragen, für die du verantwortlich bist. Verfolge Korrekturen und Bestätigungen deines Arbeitsplatzes."),
    workplaces:c("Beheer binnen je toegewezen werkplek de ploegcontext, shifts en personeelsinformatie die je rol toelaat. Andere werkplekken blijven buiten je beheer.","Within your assigned workplace, manage the crew context, shifts and personnel information allowed by your role. Other workplaces remain outside your management scope.","Dans votre poste attribué, gérez le contexte de l’équipe, les shifts et les informations du personnel autorisés par votre rôle. Les autres postes restent hors de votre périmètre.","Verwalte in deinem zugewiesenen Arbeitsplatz Crew-Kontext, Schichten und Personalinformationen, soweit deine Rolle dies erlaubt. Andere Arbeitsplätze bleiben außerhalb deines Bereichs."),
    inventory:c("Voer de opstart- en afsluitchecklist uit en meld ontbrekend of defect materiaal zodat admin dit centraal kan opvolgen.","Complete the opening and closing checklist and report missing or defective equipment so admin can follow it centrally.","Effectuez la checklist d’ouverture et de fermeture et signalez le matériel manquant ou défectueux afin que l’admin puisse le suivre centralement.","Führe die Öffnungs- und Abschlusscheckliste aus und melde fehlendes oder defektes Material, damit Admin es zentral nachverfolgen kann."),
    guestlist:c("Wanneer Inkom bij jouw werkplek hoort, controleer je guests en artiesten, spots en aankomststatus en help je personeel bij uitzonderingen.","When Entrance belongs to your workplace, monitor guests and artists, spots and arrival status and help staff with exceptions.","Lorsque l’entrée appartient à votre poste, contrôlez les invités et artistes, les places et le statut d’arrivée et aidez le personnel pour les exceptions.","Wenn der Eingang zu deinem Arbeitsplatz gehört, kontrollierst du Gäste und Künstler, Plätze und Ankunftsstatus und unterstützt das Personal bei Ausnahmen."),
    sales:c("Volg of registreer verkoop binnen de rechten van je werkplek en controleer dat de juiste eventcontext, aantallen en betaalmethode gebruikt worden.","Follow or register sales within your workplace permissions and verify the correct event context, quantities and payment method.","Suivez ou enregistrez les ventes dans les droits de votre poste et vérifiez le bon contexte d’événement, les quantités et le moyen de paiement.","Verfolge oder erfasse Verkäufe innerhalb deiner Arbeitsplatzrechte und prüfe Eventkontext, Mengen und Zahlungsmethode."),
    briefings:c("Lees je eigen briefing, bereid werkplekinstructies voor waar toegestaan en volg op of je ploeg de verplichte briefing heeft bevestigd.","Read your own briefing, prepare workplace instructions where allowed and follow whether your crew has confirmed the required briefing.","Lisez votre briefing, préparez les instructions du poste lorsque c’est autorisé et suivez si votre équipe a confirmé le briefing obligatoire.","Lies dein eigenes Briefing, bereite erlaubte Arbeitsplatzanweisungen vor und verfolge, ob deine Crew das verpflichtende Briefing bestätigt hat."),
    tasks:c("Maak en beheer taken voor je eigen werkplek, wijs ze aan de juiste mensen toe en volg deadline en status op.","Create and manage tasks for your own workplace, assign them to the correct people and follow deadline and status.","Créez et gérez les tâches de votre propre poste, attribuez-les aux bonnes personnes et suivez l’échéance et le statut.","Erstelle und verwalte Aufgaben für deinen eigenen Arbeitsplatz, weise sie den richtigen Personen zu und verfolge Frist und Status."),
    chat:c("Gebruik organisatie-, event- en werkplekchat om je ploeg operationeel aan te sturen en context bij taken of incidenten te delen.","Use organisation, event and workplace chat to coordinate your crew operationally and share context for tasks or incidents.","Utilisez les chats organisation, événement et poste pour coordonner votre équipe et partager le contexte des tâches ou incidents.","Nutze Organisations-, Event- und Arbeitsplatzchat, um deine Crew operativ zu koordinieren und Kontext zu Aufgaben oder Vorfällen zu teilen."),
    crew:c("Bekijk de ploeg en personeelsinformatie die binnen jouw werkplek en rol valt. Je krijgt geen beheerrechten over personeel buiten die scope.","View the crew and personnel information within your workplace and role scope. You do not get management rights over personnel outside that scope.","Consultez l’équipe et les informations du personnel dans le périmètre de votre poste et de votre rôle. Vous n’obtenez pas de droits de gestion hors de ce périmètre.","Sieh Crew- und Personalinformationen innerhalb deines Arbeitsplatz- und Rollenbereichs. Du erhältst keine Verwaltungsrechte über Personal außerhalb dieses Bereichs."),
    incidents:c("Meld, erken en volg incidenten van je eigen werkplek op. Escaleer naar admin wanneer het probleem buiten je bevoegdheid valt.","Report, acknowledge and follow incidents for your own workplace. Escalate to admin when the issue is outside your authority.","Signalez, reconnaissez et suivez les incidents de votre poste. Escaladez vers l’admin lorsque le problème dépasse votre autorité.","Melde, bestätige und verfolge Vorfälle deines Arbeitsplatzes. Eskaliere an Admin, wenn das Problem außerhalb deiner Befugnis liegt."),
    settings:c("Beheer je profiel en taal en gebruik deze pagina om de rondleiding later opnieuw te starten.","Manage your profile and language and use this page to restart the tour later.","Gérez votre profil et votre langue et utilisez cette page pour relancer la visite plus tard.","Verwalte dein Profil und deine Sprache und starte die Führung hier später erneut."),
  },
  admin:{
    overview:c("Gebruik dit als centrale operationele cockpit: actieve crew, lopende diensten en pauzes, timers, meldingen en acties met prioriteit.","Use this as the central operational cockpit: active crew, running shifts and breaks, timers, notifications and priority actions.","Utilisez ceci comme cockpit opérationnel central : équipe active, shifts et pauses en cours, chronomètres, notifications et actions prioritaires.","Nutze dies als zentrale operative Leitstelle: aktive Crew, laufende Schichten und Pausen, Timer, Meldungen und Prioritätsaktionen."),
    events:c("Maak evenementen, stel deadlines en capaciteit in, beheer beschikbaarheid, documenten, briefing, readiness, afsluiting en archivering.","Create events, set deadlines and capacity, and manage availability, documents, briefing, readiness, closure and archiving.","Créez des événements, définissez les délais et la capacité et gérez disponibilité, documents, briefing, préparation, clôture et archivage.","Erstelle Events, setze Fristen und Kapazität und verwalte Verfügbarkeit, Dokumente, Briefing, Bereitschaft, Abschluss und Archivierung."),
    operations:c("Beheer check-in/out, pauzes, correcties, timesheets, goedkeuringen en overtime. Goedgekeurde tijden kunnen daarna worden gelockt en geëxporteerd.","Manage check-in/out, breaks, corrections, timesheets, approvals and overtime. Approved times can then be locked and exported.","Gérez check-in/out, pauses, corrections, feuilles de temps, approbations et heures supplémentaires. Les heures approuvées peuvent ensuite être verrouillées et exportées.","Verwalte Check-in/out, Pausen, Korrekturen, Timesheets, Genehmigungen und Überstunden. Genehmigte Zeiten können danach gesperrt und exportiert werden."),
    workplaces:c("Maak werkplekken en shifts, koppel uren, wijs verantwoordelijken en personeel toe en open vanuit de werkplek de gekoppelde operationele modules.","Create workplaces and shifts, link hours, assign responsible leads and staff, and open the linked operational modules from the workplace.","Créez des postes et shifts, liez les heures, attribuez responsables et personnel et ouvrez les modules opérationnels liés depuis le poste.","Erstelle Arbeitsplätze und Schichten, verknüpfe Zeiten, weise Verantwortliche und Personal zu und öffne die verknüpften operativen Module vom Arbeitsplatz aus."),
    inventory:c("Beheer vooraf het materiaal per werkplek, voeg foto’s, documenten en tekst toe en volg meldingen van ontbrekend of defect materiaal op.","Manage equipment per workplace in advance, add photos, documents and text, and follow reports of missing or defective equipment.","Gérez à l’avance le matériel par poste, ajoutez photos, documents et texte et suivez les signalements de matériel manquant ou défectueux.","Verwalte Material pro Arbeitsplatz im Voraus, füge Fotos, Dokumente und Text hinzu und verfolge Meldungen zu fehlendem oder defektem Material."),
    guestlist:c("Beheer guestlist en inkomgegevens per evenement of werkplek, importeer waar nodig en onderscheid gasten, artiesten, spots en aankomststatus.","Manage guest list and entrance data per event or workplace, import when needed and distinguish guests, artists, spots and arrival status.","Gérez la guestlist et les données d’entrée par événement ou poste, importez si nécessaire et distinguez invités, artistes, places et statut d’arrivée.","Verwalte Gästeliste und Eingangsdaten pro Event oder Arbeitsplatz, importiere bei Bedarf und unterscheide Gäste, Künstler, Plätze und Ankunftsstatus."),
    sales:c("Gebruik Sales uitsluitend voor eventinkomsten zoals merch en kassa/tokens. Controleer eventcontext, betaalmethode en totalen.","Use Sales only for event revenue such as merch and cash desk/tokens. Verify event context, payment method and totals.","Utilisez Sales uniquement pour les revenus d’événement comme merch et caisse/tokens. Vérifiez le contexte, le moyen de paiement et les totaux.","Nutze Sales nur für Eventeinnahmen wie Merch und Kasse/Tokens. Prüfe Eventkontext, Zahlungsmethode und Summen."),
    briefings:c("Maak event- en werkplekbriefings, koppel checklists en volg verplichte bevestigingen en reminders op.","Create event and workplace briefings, link checklists and follow required acknowledgements and reminders.","Créez des briefings d’événement et de poste, liez des checklists et suivez les confirmations obligatoires et rappels.","Erstelle Event- und Arbeitsplatzbriefings, verknüpfe Checklisten und verfolge verpflichtende Bestätigungen und Erinnerungen."),
    tasks:c("Maak taken voor alle toegestane werkplekken, wijs één of meerdere personen toe en volg deadline, status en escalaties.","Create tasks for all permitted workplaces, assign one or more people and follow deadline, status and escalations.","Créez des tâches pour tous les postes autorisés, attribuez une ou plusieurs personnes et suivez échéance, statut et escalades.","Erstelle Aufgaben für alle erlaubten Arbeitsplätze, weise eine oder mehrere Personen zu und verfolge Frist, Status und Eskalationen."),
    chat:c("Beheer en volg organisatie-, event- en werkplekcommunicatie en gebruik unread-indicatoren om nieuwe operationele berichten te vinden.","Manage and follow organisation, event and workplace communication and use unread indicators to find new operational messages.","Gérez et suivez la communication organisation, événement et poste et utilisez les indicateurs non lus pour trouver les nouveaux messages opérationnels.","Verwalte Organisations-, Event- und Arbeitsplatzkommunikation und nutze Ungelesen-Anzeigen, um neue operative Nachrichten zu finden."),
    crew:c("Beheer goedgekeurd personeel, rollen, blokkeringen, toekomstige planning en accountverwijdering. De makeraccount blijft beschermd.","Manage approved staff, roles, blocks, future planning and account deletion. The maker account remains protected.","Gérez le personnel approuvé, les rôles, blocages, planning futur et suppression de comptes. Le compte créateur reste protégé.","Verwalte genehmigtes Personal, Rollen, Sperren, zukünftige Planung und Kontolöschung. Das Maker-Konto bleibt geschützt."),
    incidents:c("Bekijk alle operationele hulpvragen en incidenten, erken of escaleer ze en sluit ze pas af wanneer de opvolging voltooid is.","View all operational help requests and incidents, acknowledge or escalate them and close them only when follow-up is complete.","Consultez toutes les demandes d’aide et incidents opérationnels, reconnaissez-les ou escaladez-les et ne les clôturez qu’une fois le suivi terminé.","Sieh alle operativen Hilfeanfragen und Vorfälle, bestätige oder eskaliere sie und schließe sie erst nach vollständiger Nachverfolgung."),
    exports:c("Exporteer goedgekeurde en gelockte werkuren voor administratie. Controleer eerst timesheetstatus en correcties.","Export approved and locked work hours for administration. Check timesheet status and corrections first.","Exportez les heures approuvées et verrouillées pour l’administration. Vérifiez d’abord le statut des feuilles de temps et les corrections.","Exportiere genehmigte und gesperrte Arbeitszeiten für die Verwaltung. Prüfe zuerst Timesheet-Status und Korrekturen."),
    personnel:c("Behandel hier alleen nieuwe accountaanvragen: keur goed en wijs de initiële rol toe. Daarna verhuist het account naar Personeel.","Process new account requests only here: approve them and assign the initial role. Afterwards the account moves to Staff.","Traitez ici uniquement les nouvelles demandes de compte : approuvez-les et attribuez le rôle initial. Ensuite le compte passe dans Personnel.","Bearbeite hier nur neue Kontoanträge: genehmigen und anfängliche Rolle zuweisen. Danach wechselt das Konto zu Personal."),
    platform:c("Beheer geavanceerde automatiseringen, planning, templates, rollouts, QR, recovery, rapportage en technische platformconfiguratie.","Manage advanced automations, planning, templates, rollouts, QR, recovery, reporting and technical platform configuration.","Gérez les automatisations avancées, la planification, les modèles, rollouts, QR, recovery, rapports et la configuration technique de la plateforme.","Verwalte fortgeschrittene Automatisierungen, Planung, Vorlagen, Rollouts, QR, Recovery, Berichte und technische Plattformkonfiguration."),
    settings:c("Beheer profiel, taal en centrale instellingen. Gebruik deze pagina ook om de rolrondleidingen opnieuw te starten.","Manage profile, language and central settings. Use this page to restart role tours as well.","Gérez le profil, la langue et les paramètres centraux. Utilisez aussi cette page pour relancer les visites par rôle.","Verwalte Profil, Sprache und zentrale Einstellungen. Hier kannst du auch die Rollenführungen neu starten."),
  },
}

const ROUTES:Record<string,string>={
  overview:"/",
  events:"/events",
  operations:"/operations",
  workplaces:"/workplaces",
  inventory:"/inventory",
  guestlist:"/guestlist",
  sales:"/sales",
  briefings:"/briefings",
  tasks:"/tasks",
  chat:"/chat",
  crew:"/crew",
  incidents:"/incidents",
  exports:"/exports",
  personnel:"/personnel",
  platform:"/admin/platform",
  settings:"/settings",
}

const TOUR_DEMO_QUERY="?tour=1"
const DEMO_FEATURES=new Set(["overview","events","operations","workplaces","briefings","tasks","inventory","guestlist","sales"])

const PAGE_SELECTORS:Record<string,string>={
  overview:"main",
  events:"main form, main",
  operations:"main button, main",
  workplaces:"main form, main",
  inventory:"main button, main",
  guestlist:"main input, main select, main",
  sales:"main form, main",
  briefings:"main form, main",
  tasks:"main form, main",
  chat:"main textarea, main",
  crew:"main",
  incidents:"main form, main",
  exports:"main",
  personnel:"main form, main",
  platform:"main",
  settings:"main form, main",
}

const ROLE_FEATURES:Record<UiRole,string[]>={
  employee:["overview","events","operations","workplaces","briefings","tasks","inventory","guestlist","sales","chat","crew","incidents","settings"],
  responsible_lead:["overview","events","operations","workplaces","briefings","tasks","inventory","guestlist","sales","chat","crew","incidents","settings"],
  admin:["overview","events","operations","workplaces","briefings","tasks","inventory","guestlist","sales","personnel","crew","chat","incidents","exports","platform","settings"],
}

function makeFeatureStep(role:UiRole,key:string):Step{
  const help=featureHelp(key)
  const baseRoute=key==="overview"&&role==="admin"?"/admin":ROUTES[key]
  const route=baseRoute&&(DEMO_FEATURES.has(key)||key==="overview"?baseRoute+TOUR_DEMO_QUERY:baseRoute)
  return {
    heading:UI_COPY.what,
    body:help.description,
    selector:'[data-layout-key="'+key+'"]',
    route,
    inside:[
      {heading:UI_COPY.how,body:HOW_COPY[role][key]||GENERIC_HOW,selector:'[data-tour-demo="primary-action"], [data-tour-demo="time-actions"] button, [data-tour-demo="shift"] article, [data-tour-demo] button, [data-tour-demo] article, '+(PAGE_SELECTORS[key]||"main")},
    ],
  }
}

const tours:Record<UiRole,Step[]>={
  employee:[
    {heading:WELCOME.employee.heading,body:WELCOME.employee.body,selector:"header"},
    ...ROLE_FEATURES.employee.map(key=>makeFeatureStep("employee",key)),
  ],
  responsible_lead:[
    {heading:WELCOME.responsible_lead.heading,body:WELCOME.responsible_lead.body,selector:"header"},
    ...ROLE_FEATURES.responsible_lead.map(key=>makeFeatureStep("responsible_lead",key)),
  ],
  admin:[
    {heading:WELCOME.admin.heading,body:WELCOME.admin.body,selector:"header"},
    ...ROLE_FEATURES.admin.map(key=>makeFeatureStep("admin",key)),
    {
      heading:c("Admin AI","Admin AI","IA Admin","Admin-KI"),
      body:c("De contextuele AI-assistent helpt bij beheer, analyse en uitvoering vanuit de actieve admincontext.","The contextual AI assistant helps with management, analysis and execution from the active admin context.","L’assistant IA contextuel aide à la gestion, à l’analyse et à l’exécution depuis le contexte admin actif.","Der kontextbezogene KI-Assistent unterstützt Verwaltung, Analyse und Ausführung aus dem aktiven Admin-Kontext."),
      selector:'button[aria-expanded]',
      route:"/admin",
      inside:[
        {heading:UI_COPY.what,body:c("De knop opent de AI-assistent zonder de huidige beheercontext te verlaten.","The button opens the AI assistant without leaving the current management context.","Le bouton ouvre l’assistant IA sans quitter le contexte de gestion actuel.","Die Schaltfläche öffnet den KI-Assistenten, ohne den aktuellen Verwaltungskontext zu verlassen."),selector:'button[aria-expanded]'},
        {heading:UI_COPY.how,body:c("Typ vrij wat je wilt controleren of uitvoeren. Controleer gevoelige of destructieve acties altijd vóór bevestiging.","Type freely what you want to check or execute. Always review sensitive or destructive actions before confirmation.","Saisissez librement ce que vous voulez contrôler ou exécuter. Vérifiez toujours les actions sensibles ou destructives avant confirmation.","Gib frei ein, was du prüfen oder ausführen möchtest. Prüfe sensible oder destruktive Aktionen immer vor der Bestätigung."),selector:'button[aria-expanded]'},
      ],
    },
  ],
}

const VERSION=7
function storageKey(userId:string,role:UiRole){return "uptilldawn-app-tour:"+userId+":"+role+":v"+VERSION}

export function RoleAppTour(){
  const {user,roles,loading}=useAuth()
  const role=roles[0]
  const router=useRouter()
  const pathname=usePathname()
  const [tourRole,setTourRole]=useState<UiRole|null>(null)
  const activeRole=tourRole||role
  const steps=useMemo(()=>activeRole?tours[activeRole]:[],[activeRole])
  const [open,setOpen]=useState(false)
  const [choice,setChoice]=useState(false)
  const [index,setIndex]=useState(0)
  const [insideIndex,setInsideIndex]=useState(-1)
  // Keep SSR and the first hydration render identical. Device/manual locale is
  // applied only after mount; this removes the React #418 hydration mismatch.
  const [locale,setLocale]=useState<ExtendedUiLocale>("nl")

  useEffect(()=>{
    const on=(event:Event)=>{
      const next=parseUiLocale((event as CustomEvent<string>).detail)
      if(next)setLocale(next as ExtendedUiLocale)
    }
    addEventListener(LANGUAGE_APPLIED_EVENT,on)
    return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,on)
  },[])

  const resolve=(value:Copy)=>{
    if(typeof value!=="string")return value[locale]
    return translateRuntimeUi(value,locale)
  }

  const step=steps[index]

  useEffect(()=>{
    if(loading||!user||!role)return
    let alive=true
    const check=async()=>{
      const {data}=await createClient().rpc("upt_current_profile_completion")
      if(!alive)return
      const state=data?.[0]
      if(state?.required&&!state.completed){
        if(location.pathname!=="/settings")router.replace("/settings?complete-profile=1")
        return
      }
      const saved=localStorage.getItem(storageKey(user.id,role))
      if(saved==="completed"||saved==="postponed"){
        setChoice(false)
        return
      }
      if(state?.required&&state.completed){
        setChoice(true)
        return
      }
      setChoice(false)
    }
    void check()
    const completed=()=>void check()
    const restart=(event:Event)=>{
      const requested=(event as CustomEvent<UiRole|undefined>).detail
      const nextRole=requested&&tours[requested]?requested:role
      const active=parseUiLocale(document.documentElement.lang)
      if(active)setLocale(active as ExtendedUiLocale)
      setTourRole(nextRole)
      setIndex(0)
      setInsideIndex(-1)
      setChoice(false)
      setOpen(true)
      router.push((nextRole==="admin"?"/admin":"/")+"?tour=1")
      sessionStorage.setItem("uptilldawn-tour-preview-route","1")
      dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active:true,role:nextRole}}))
    }
    addEventListener("uptilldawn-profile-completed",completed)
    addEventListener("uptilldawn-restart-tour",restart)
    return()=>{
      alive=false
      removeEventListener("uptilldawn-profile-completed",completed)
      removeEventListener("uptilldawn-restart-tour",restart)
      dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active:false}}))
    }
  },[loading,role,router,user])

  useEffect(()=>{
    if(!open||!step)return
    const wanted=step.route?.split("?")[0]
    if(step.route&&wanted&&pathname!==wanted){
      router.push(step.route)
      sessionStorage.setItem("uptilldawn-tour-preview-route","1")
    }
  },[index,open,pathname,router,step])


  if(!user||!role||!activeRole)return null

  const setPreview=(active:boolean)=>dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active,role:activeRole}}))
  const later=()=>{
    localStorage.setItem(storageKey(user.id,activeRole),"postponed")
    setChoice(false)
    setPreview(false)
  }
  const start=()=>{
    const active=parseUiLocale(document.documentElement.lang)
    if(active)setLocale(active as ExtendedUiLocale)
    setTourRole(role)
    setChoice(false)
    setIndex(0)
    setInsideIndex(-1)
    setOpen(true)
    router.push((role==="admin"?"/admin":"/")+"?tour=1")
    sessionStorage.setItem("uptilldawn-tour-preview-route","1")
    setPreview(true)
  }

  return <>
    {choice&&<div data-no-translate className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
      <section className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl">
        <h2 className="text-xl font-black">{resolve(UI_COPY.promptTitle)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{resolve(UI_COPY.promptBody)}</p>
        <div className="mt-5 flex gap-2">
          <button onClick={start} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 font-black text-white">{resolve(UI_COPY.start)}</button>
          <button onClick={later} className="rounded-xl border px-4 py-3 font-bold">{resolve(UI_COPY.later)}</button>
        </div>
      </section>
    </div>}


  </>
}

export function RestartRoleTourButton(){
  const {isOwner}=useAuth()
  const start=(role?:UiRole)=>dispatchEvent(new CustomEvent("uptilldawn-restart-tour",{detail:role}))
  if(!isOwner)return <button type="button" onClick={()=>start()} className="rounded-xl border px-4 py-3 font-bold">RONDLEIDING OPNIEUW STARTEN</button>
  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>start("admin")} className="rounded-xl border px-4 py-3 font-bold">ADMIN RONDLEIDING</button>
    <button type="button" onClick={()=>start("responsible_lead")} className="rounded-xl border px-4 py-3 font-bold">VERANTWOORDELIJKE RONDLEIDING</button>
    <button type="button" onClick={()=>start("employee")} className="rounded-xl border px-4 py-3 font-bold">PERSONEEL RONDLEIDING</button>
  </div>
}
