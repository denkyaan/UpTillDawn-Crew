import type {TourRole,TourCopy} from "./tour-training"

// An explicit operation inventory is required for every role and every training
// chapter. An operation cannot be credited by visiting a page or waiting.
export type PracticeKind="inspect"|"write"|"select"|"toggle"|"message"|"number"|"schedule"|"upload"|"delete"|"form"
export type PracticeOperation={id:string;kind:PracticeKind;title:TourCopy;help:TourCopy}
type Chapter=string
const c=(nl:string,en:string,fr:string,de:string):TourCopy=>({nl,en,fr,de})
// Every row is kind|Dutch|English|French|German. IDs derive from a stable
// chapter/role/index, never translated text.
const SHARED:Record<Chapter,string>={
overview:`
inspect|Open het actieve evenement|Open the active event|Ouvrir l’événement actif|Aktives Event öffnen
inspect|Controleer de status en locatie|Review status and location|Vérifier le statut et le lieu|Status und Ort prüfen
inspect|Bekijk je rol en toegangsrechten|Review your role and permissions|Vérifier votre rôle et vos droits|Rolle und Berechtigungen prüfen
inspect|Bekijk de beschikbare werkplekken|View available workplaces|Voir les postes disponibles|Verfügbare Arbeitsplätze ansehen
inspect|Controleer de meldingen|Review notifications|Consulter les notifications|Benachrichtigungen prüfen
inspect|Open de bijbehorende helpinformatie|Open contextual help|Ouvrir l’aide contextuelle|Kontexthilfe öffnen
`,
events:`
inspect|Open de evenementdetails|Open event details|Ouvrir les détails de l’événement|Eventdetails öffnen
inspect|Bekijk de aanmelddeadline|Review registration deadline|Vérifier la date limite d’inscription|Anmeldefrist prüfen
inspect|Controleer maximumbezetting en wachtlijst|Review capacity and waiting list|Vérifier la capacité et la liste d’attente|Kapazität und Warteliste prüfen
select|Selecteer je beschikbaarheid|Select your availability|Sélectionner votre disponibilité|Verfügbarkeit auswählen
select|Selecteer opbouwbeschikbaarheid|Select setup availability|Sélectionner la disponibilité montage|Aufbauverfügbarkeit auswählen
select|Selecteer afbouwbeschikbaarheid|Select teardown availability|Sélectionner la disponibilité démontage|Abbauverfügbarkeit auswählen
inspect|Controleer de aanmeldbevestiging|Review availability confirmation|Vérifier la confirmation de disponibilité|Bestätigung der Verfügbarkeit prüfen
`,
workplaces:`
inspect|Open de werkplekdetails|Open workplace details|Ouvrir les détails du poste|Arbeitsplatzdetails öffnen
inspect|Bekijk de shifturen|Review shift hours|Vérifier les horaires|Schichtzeiten prüfen
inspect|Bekijk de verantwoordelijke en ploeg|View responsible lead and crew|Voir le responsable et l’équipe|Verantwortliche und Team ansehen
inspect|Controleer de werkplekinstructies|Review workplace instructions|Consulter les consignes du poste|Arbeitsplatzanweisungen prüfen
inspect|Open de gekoppelde prijslijst|Open linked price list|Ouvrir la liste des prix liée|Verknüpfte Preisliste öffnen
`,
briefings:`
inspect|Open de evenementbriefing|Open event briefing|Ouvrir le briefing événement|Event-Briefing öffnen
inspect|Lees de veiligheidsinstructies|Read safety instructions|Lire les consignes de sécurité|Sicherheitshinweise lesen
inspect|Lees de werkplekspecifieke instructies|Read workplace-specific instructions|Lire les consignes du poste|Arbeitsplatzanweisungen lesen
inspect|Controleer de openingschecklist|Review opening checklist|Vérifier la checklist d’ouverture|Start-Checkliste prüfen
inspect|Controleer de afsluitchecklist|Review closing checklist|Vérifier la checklist de fermeture|Abschluss-Checkliste prüfen
toggle|Bevestig dat je de briefing gelezen hebt|Acknowledge reading the briefing|Confirmer la lecture du briefing|Lesen des Briefings bestätigen
`,
operations:`
inspect|Controleer de toegewezen shift|Review assigned shift|Vérifier le shift attribué|Zugewiesene Schicht prüfen
inspect|Open de aanwijzingsgegevens|Open check-in details|Ouvrir les détails de pointage|Check-in-Details öffnen
inspect|Controleer de GPS-zone|Review GPS radius|Vérifier le rayon GPS|GPS-Radius prüfen
inspect|Controleer de live werktimer|Review live work timer|Vérifier le chronomètre de travail|Arbeitszeittimer prüfen
inspect|Bekijk het pauzebeleid|Review break policy|Consulter la politique des pauses|Pausenregelung prüfen
`,
driver:`
inspect|Open de toegewezen rit|Open assigned trip|Ouvrir le trajet attribué|Zugewiesene Fahrt öffnen
inspect|Bekijk het ophaaladres en contact|View pickup address and contact|Voir l’adresse et le contact|Abholadresse und Kontakt ansehen
inspect|Bekijk de rijtijd en ETA|Review travel time and ETA|Vérifier le trajet et l’ETA|Fahrzeit und ETA prüfen
inspect|Controleer de melding 15 minuten vooraf|Review 15-minute reminder|Vérifier le rappel 15 minutes avant|15-Minuten-Erinnerung prüfen
toggle|Bevestig eerste aankomst op het evenement|Confirm first arrival at event|Confirmer la première arrivée|Erste Ankunft beim Event bestätigen
toggle|Start de eventwerktijd|Start event work time|Démarrer le temps de travail événement|Event-Arbeitszeit starten
toggle|Start Driving en pauzeer eventuren|Start Driving and pause event time|Démarrer la conduite et suspendre les heures|Fahrt starten und Eventzeit pausieren
toggle|Bevestig aankomst bij de persoon|Confirm pickup arrival|Confirmer l’arrivée au point de prise en charge|Ankunft am Abholort bestätigen
toggle|Start de terugrit met artiest|Start return trip with artist|Démarrer le retour avec l’artiste|Rückfahrt mit Künstler beginnen
toggle|Stop Driving bij aankomst op evenement|Stop Driving when back at event|Arrêter la conduite au retour|Fahrt bei Rückkehr beenden
inspect|Controleer automatisch berekende kilometers|Review calculated mileage|Vérifier le kilométrage calculé|Berechnete Kilometer prüfen
inspect|Controleer de Backstage-aankomstmelding|Review backstage arrival notification|Vérifier la notification Backstage|Backstage-Ankunftsmeldung prüfen
`,
tasks:`
inspect|Open de toegewezen taak|Open assigned task|Ouvrir la tâche attribuée|Zugewiesene Aufgabe öffnen
inspect|Lees de taakomschrijving en deadline|Read task details and deadline|Lire les détails et l’échéance|Aufgabenbeschreibung und Frist lesen
inspect|Bekijk de toegewezen personen|Review assigned people|Vérifier les personnes désignées|Zugewiesene Personen ansehen
message|Stuur een taakopmerking|Send a task comment|Envoyer un commentaire de tâche|Aufgabenkommentar senden
toggle|Markeer de demotaak als voltooid|Mark demo task completed|Marquer la tâche démo terminée|Demo-Aufgabe als erledigt markieren
`,
incidents:`
inspect|Open Help en incidenten|Open Help and incidents|Ouvrir Aide et incidents|Hilfe und Vorfälle öffnen
select|Selecteer een incidentcategorie|Select incident category|Choisir une catégorie d’incident|Vorfallkategorie auswählen
message|Beschrijf het incident|Describe the incident|Décrire l’incident|Vorfall beschreiben
select|Kies de urgentiegraad|Select urgency|Choisir le niveau d’urgence|Dringlichkeitsstufe wählen
inspect|Controleer de GPS-coördinaten|Review GPS coordinates|Vérifier les coordonnées GPS|GPS-Koordinaten prüfen
toggle|Verstuur een fictieve hulpvraag|Send a fictional help request|Envoyer une demande d’aide fictive|Fiktive Hilfeanfrage senden
inspect|Bekijk de status van de melding|Review incident status|Vérifier le statut du signalement|Vorfallstatus prüfen
`,
inventory:`
inspect|Open inventaris van de werkplek|Open workplace inventory|Ouvrir l’inventaire du poste|Arbeitsplatzinventar öffnen
inspect|Bekijk materiaalfoto’s en documenten|View material photos and documents|Voir les photos et documents|Materialfotos und Dokumente ansehen
inspect|Controleer de aantallen|Review quantities|Vérifier les quantités|Mengen prüfen
toggle|Vink de opstartcontrole af|Complete opening inspection|Effectuer le contrôle d’ouverture|Startkontrolle abschließen
select|Geef materiaalstatus aan|Report equipment condition|Indiquer l’état du matériel|Materialzustand melden
message|Meld een ontbrekend item|Report missing item|Signaler un objet manquant|Fehlenden Gegenstand melden
toggle|Vink de afsluitcontrole af|Complete closing inspection|Effectuer le contrôle de fermeture|Abschlusskontrolle abschließen
`,
guestlist:`
inspect|Open de zoekbare gastenlijst|Open searchable guest list|Ouvrir la liste d’invités consultable|Durchsuchbare Gästeliste öffnen
write|Zoek een gast op naam|Search guest by name|Rechercher un invité par nom|Gast nach Namen suchen
select|Filter op artiest of gast|Filter artists or guests|Filtrer artiste ou invité|Nach Künstler oder Gast filtern
inspect|Controleer het aantal guestspots|Review guest spot allocation|Vérifier les places invités|Gästeplätze prüfen
toggle|Vink een fictieve aankomst af|Check in a fictional arrival|Enregistrer une arrivée fictive|Fiktive Ankunft abhaken
inspect|Controleer de Backstage-melding|Review backstage notification|Vérifier la notification Backstage|Backstage-Benachrichtigung prüfen
`,
crew:`
inspect|Open de personeelslijst|Open staff directory|Ouvrir la liste du personnel|Personalliste öffnen
write|Zoek een medewerker|Search a staff member|Rechercher un membre du personnel|Mitarbeiter suchen
inspect|Open het personeelsprofiel|Open staff profile|Ouvrir le profil du personnel|Personalprofil öffnen
inspect|Bekijk werkplek en contactgegevens|View workplace and contact information|Voir le poste et les coordonnées|Arbeitsplatz und Kontaktdaten ansehen
inspect|Controleer rolgebonden zichtbaarheid|Review role-scoped visibility|Vérifier la visibilité par rôle|Rollenbezogene Sichtbarkeit prüfen
`,
chat:`
inspect|Open de organisatiechat|Open organisation chat|Ouvrir le chat organisation|Organisationschat öffnen
inspect|Open de evenementchat|Open event chat|Ouvrir le chat événement|Eventchat öffnen
inspect|Open de werkplekchat|Open workplace chat|Ouvrir le chat de poste|Arbeitsplatzchat öffnen
write|Zoek een deelnemer|Search for a participant|Rechercher un participant|Teilnehmer suchen
select|Kies een persoon voor privéchat|Select someone for private chat|Choisir une personne pour le chat privé|Person für Privatchat auswählen
message|Start een privégesprek|Start private conversation|Démarrer une conversation privée|Private Unterhaltung beginnen
message|Verstuur een groepsbericht|Send a group message|Envoyer un message de groupe|Gruppennachricht senden
message|Antwoord op een bericht|Reply to a message|Répondre à un message|Auf Nachricht antworten
message|Gebruik een @-vermelding|Use an @-mention|Utiliser une mention @|@-Erwähnung verwenden
upload|Voeg een demobijlage toe|Attach a demo file|Joindre un fichier démo|Demo-Datei anhängen
inspect|Controleer de bijlage en veiligheidscontrole|Review attachment and security scan|Vérifier la pièce jointe et l’analyse|Anhang und Sicherheitsprüfung prüfen
inspect|Controleer de berichttijd en afzender|Review message timestamp and sender|Vérifier la date et l’expéditeur|Zeitstempel und Absender prüfen
toggle|Markeer de chat als gelezen|Mark chat as read|Marquer le chat lu|Chat als gelesen markieren
toggle|Verwijder de privéchat uit de lijst|Remove private chat from list|Retirer le chat privé de la liste|Privatchat aus Liste entfernen
inspect|Controleer dat berichten behouden blijven|Verify message retention|Vérifier la conservation des messages|Nachrichtenerhalt prüfen
`,
settings:`
inspect|Open je profielinstellingen|Open profile settings|Ouvrir les paramètres du profil|Profileinstellungen öffnen
write|Pas een fictieve profielwaarde aan|Edit fictional profile field|Modifier un champ fictif du profil|Fiktives Profilfeld bearbeiten
select|Kies de voorkeurstaal|Choose preferred language|Choisir la langue préférée|Bevorzugte Sprache auswählen
inspect|Controleer de synchronisatie van de toestelstaal|Review device-language sync|Vérifier la synchronisation de langue|Gerätesprache-Synchronisierung prüfen
toggle|Controleer meldingsvoorkeuren|Review notification preferences|Vérifier les préférences de notification|Benachrichtigungseinstellungen prüfen
inspect|Bekijk de appinstallatie op Android|Review Android installation|Consulter l’installation Android|Android-Installation ansehen
inspect|Bekijk de appinstallatie op iOS|Review iOS installation|Consulter l’installation iOS|iOS-Installation ansehen
inspect|Bekijk de appinstallatie op Windows|Review Windows installation|Consulter l’installation Windows|Windows-Installation ansehen
inspect|Controleer pushmeldingen en achtergrondupdates|Review push and background updates|Vérifier les notifications et mises à jour|Push und Hintergrundupdates prüfen
`,
help:`
inspect|Open de functiehandleiding|Open feature guide|Ouvrir le guide des fonctions|Funktionshandbuch öffnen
write|Zoek een onderwerp in Help|Search a help topic|Rechercher un sujet d’aide|Hilfethema suchen
inspect|Bekijk de rollen en hun rechten|Review roles and permissions|Consulter les rôles et droits|Rollen und Berechtigungen prüfen
inspect|Bekijk het volledige trainingsprogramma|Review full training curriculum|Consulter le programme complet|Gesamten Trainingsplan ansehen
inspect|Open de uitleg over de QR-code|Open QR-code instructions|Ouvrir les instructions du QR code|QR-Code-Anleitung öffnen
inspect|Bekijk de herstartoptie voor rondleidingen|View tour restart option|Voir l’option de redémarrage|Neustartoption der Führung ansehen
`,
timesheet:`
inspect|Open de fictieve urenstaat|Open fictional timesheet|Ouvrir la feuille d’heures fictive|Fiktiven Stundenzettel öffnen
inspect|Controleer bruto-uren, pauze en netto-uren|Review gross, break and net hours|Vérifier les heures brutes, pauses et nettes|Brutto-, Pausen- und Nettostunden prüfen
inspect|Controleer de overtime-regel|Review overtime policy|Vérifier les règles d’heures supplémentaires|Überstundenregelung prüfen
`
}
const ROLE:Record<TourRole,Record<Chapter,string>>={
admin:{
overview:`
inspect|Open het actieve personeelsoverzicht|Open active staff overview|Ouvrir l’aperçu du personnel actif|Übersicht aktives Personal öffnen
inspect|Controleer lopende shifts en pauzes|Review ongoing shifts and breaks|Vérifier les shifts et pauses en cours|Aktive Schichten und Pausen prüfen
inspect|Bekijk waarschuwingen en openstaande acties|Review alerts and pending actions|Vérifier les alertes et actions en attente|Warnungen und offene Aufgaben prüfen
inspect|Controleer verantwoordelijke per werkplek|Review lead for each workplace|Vérifier le responsable de chaque poste|Verantwortliche je Arbeitsplatz prüfen
`,
personnel:`
inspect|Open een nieuwe registratieaanvraag|Open new registration request|Ouvrir une demande d’inscription|Neue Registrierungsanfrage öffnen
inspect|Controleer e-mailverificatie|Review email verification|Vérifier l’adresse e-mail|E-Mail-Verifizierung prüfen
select|Kies de initiële rol|Choose initial role|Choisir le rôle initial|Anfangsrolle auswählen
toggle|Keur het fictieve account goed|Approve fictional account|Approuver le compte fictif|Fiktives Konto genehmigen
inspect|Controleer de goedkeuringsmelding|Review approval notification|Vérifier la notification d’approbation|Genehmigungsbenachrichtigung prüfen
message|Vraag ontbrekende gegevens op|Request missing information|Demander des données manquantes|Fehlende Angaben anfordern
toggle|Simuleer een afwijzing met reden|Simulate rejection with reason|Simuler un refus motivé|Ablehnung mit Begründung simulieren
inspect|Bekijk herverificatie en accountstatus|Review reverification and account status|Vérifier revérification et statut|Erneute Verifizierung und Kontostatus prüfen
`,
crew:`
select|Wijzig de rol van een fictieve medewerker|Change fictional staff role|Modifier le rôle d’un membre fictif|Rolle eines fiktiven Mitarbeiters ändern
toggle|Blokkeer een fictief account|Block fictional account|Bloquer un compte fictif|Fiktives Konto sperren
toggle|Deblokkeer het fictieve account|Unblock fictional account|Débloquer le compte fictif|Fiktives Konto entsperren
select|Wijzig de aangewezen werkplek|Change assigned workplace|Modifier le poste attribué|Zugewiesenen Arbeitsplatz ändern
inspect|Bekijk persoonlijke beschikbaarheden|View individual availability|Voir les disponibilités individuelles|Individuelle Verfügbarkeit ansehen
message|Stuur een personeelsmelding|Send staff notification|Envoyer une notification au personnel|Personalbenachrichtigung senden
delete|Controleer het definitief verwijderen van een demo-account|Review permanent deletion of demo account|Vérifier la suppression définitive d’un compte démo|Endgültige Löschung eines Demokontos prüfen
`,
events:`
form|Maak een nieuw fictief evenement aan|Create new fictional event|Créer un nouvel événement fictif|Neues fiktives Event erstellen
schedule|Stel de begin- en eindtijd in|Set event start and end times|Définir début et fin de l’événement|Event-Anfang und Ende festlegen
write|Voer het evenementadres in|Enter event address|Saisir l’adresse de l’événement|Eventadresse eingeben
number|Stel maximale crewbezetting in|Set maximum crew capacity|Définir la capacité maximale|Maximale Crew-Kapazität festlegen
schedule|Stel de aanmelddeadline in|Set registration deadline|Définir la date limite d’inscription|Anmeldefrist festlegen
select|Kies de evenementstatus|Choose event status|Choisir le statut de l’événement|Eventstatus auswählen
toggle|Publiceer een demo-evenement|Publish demo event|Publier un événement démo|Demo-Event veröffentlichen
inspect|Bekijk aangemelde en afwezige crew|Review available and unavailable crew|Voir les membres disponibles et indisponibles|Verfügbare und abwesende Crew ansehen
inspect|Controleer de wachtlijstprioriteit|Review waiting-list priority|Vérifier les priorités de liste d’attente|Wartelistenpriorität prüfen
select|Wijs de beschikbare plek toe|Assign an available slot|Attribuer une place disponible|Freien Platz zuweisen
message|Verstuur de spot-open melding|Send open-slot notification|Envoyer notification place libre|Benachrichtigung über freien Platz senden
inspect|Bekijk eventdocumenten en bijlagen|Review event documents|Voir les documents de l’événement|Eventdokumente ansehen
toggle|Archiveer het fictieve evenement|Archive fictional event|Archiver l’événement fictif|Fiktives Event archivieren
`,
workplaces:`
form|Maak een nieuwe werkplek aan|Create a workplace|Créer un poste de travail|Arbeitsplatz erstellen
select|Selecteer het type werkplek|Choose workplace type|Choisir le type de poste|Arbeitsplatztyp auswählen
select|Wijs een verantwoordelijke toe|Assign responsible lead|Attribuer un responsable|Verantwortliche Person zuweisen
schedule|Maak een shift met begin- en eindtijd|Create shift with start and end|Créer un shift avec horaires|Schicht mit Anfang und Ende erstellen
select|Wijs een medewerker toe aan de shift|Assign staff to shift|Affecter un membre au shift|Mitarbeiter der Schicht zuweisen
select|Wijs meerdere medewerkers toe|Assign multiple staff members|Affecter plusieurs membres|Mehrere Mitarbeiter zuweisen
toggle|Controleer de overlapinstelling|Review overlapping-shift setting|Vérifier les chevauchements|Schichtüberschneidung prüfen
inspect|Bekijk medewerkersvoorkeuren|Review workplace preferences|Voir les préférences des membres|Arbeitsplatzpräferenzen prüfen
select|Plan een vervanging bij uitval|Schedule replacement on absence|Planifier un remplacement|Ersatz bei Ausfall planen
message|Verstuur een shiftmelding|Send shift notification|Envoyer notification de shift|Schichtbenachrichtigung senden
form|Maak een Driver-opdracht aan|Create Driver assignment|Créer une mission chauffeur|Fahrerauftrag erstellen
schedule|Voer de ophaaltijd in|Enter pickup time|Saisir l’heure de prise en charge|Abholzeit eingeben
write|Voer artiest, telefoon en adres in|Enter artist, phone and address|Saisir artiste, téléphone et adresse|Künstler, Telefon und Adresse eingeben
inspect|Controleer berekende rijtijd en melding|Review travel time and alert|Vérifier temps de trajet et alerte|Fahrzeit und Meldung prüfen
`,
briefings:`
form|Maak een evenementbriefing aan|Create event briefing|Créer un briefing événement|Event-Briefing erstellen
form|Maak een werkplekbriefing aan|Create workplace briefing|Créer un briefing de poste|Arbeitsplatz-Briefing erstellen
message|Schrijf veiligheidsinstructies|Write safety instructions|Rédiger les consignes de sécurité|Sicherheitshinweise schreiben
write|Voeg een checklistpunt toe|Add checklist item|Ajouter un élément à la checklist|Checklistenpunkt hinzufügen
select|Koppel briefing aan een werkplek|Assign briefing to workplace|Lier le briefing à un poste|Briefing einem Arbeitsplatz zuweisen
upload|Voeg een briefingbijlage toe|Add briefing attachment|Joindre un document au briefing|Briefing-Anhang hinzufügen
inspect|Controleer de leesbevestigingen|Review acknowledgement status|Vérifier les confirmations de lecture|Lesebestätigungen prüfen
message|Verstuur een briefingherinnering|Send briefing reminder|Envoyer un rappel de briefing|Briefing-Erinnerung senden
`,
tasks:`
form|Maak een nieuwe taak aan|Create new task|Créer une nouvelle tâche|Neue Aufgabe erstellen
write|Beschrijf taak en instructies|Describe task and instructions|Décrire tâche et consignes|Aufgabe und Anweisungen beschreiben
select|Wijs de werkplek toe|Assign workplace|Attribuer le poste|Arbeitsplatz zuweisen
select|Wijs meerdere personen toe|Assign several people|Attribuer plusieurs personnes|Mehrere Personen zuweisen
schedule|Stel een deadline in|Set task deadline|Fixer une échéance|Aufgabenfrist festlegen
select|Wijzig taakstatus|Change task status|Modifier le statut de tâche|Aufgabenstatus ändern
inspect|Controleer taken per werkplek|Review tasks by workplace|Consulter les tâches par poste|Aufgaben je Arbeitsplatz prüfen
`,
inventory:`
form|Voeg een inventariscategorie toe|Add inventory category|Ajouter une catégorie d’inventaire|Inventarkategorie hinzufügen
form|Maak een materiaalitem aan|Create inventory item|Créer un article d’inventaire|Inventarartikel erstellen
number|Voer het aantal in|Enter quantity|Saisir la quantité|Menge eingeben
select|Koppel materiaal aan een werkplek|Link material to workplace|Lier matériel au poste|Material Arbeitsplatz zuordnen
upload|Upload een demofoto van materiaal|Upload demo material photo|Téléverser une photo démo|Demo-Materialfoto hochladen
upload|Voeg een inventarisdocument toe|Add inventory document|Joindre un document d’inventaire|Inventardokument hinzufügen
inspect|Controleer het wekelijkse overzicht|Review weekly inventory summary|Vérifier le bilan hebdomadaire|Wöchentliche Inventarübersicht prüfen
`,
guestlist:`
form|Maak een guestlist aan|Create guest list|Créer une liste d’invités|Gästeliste erstellen
write|Voeg een gast toe|Add guest|Ajouter un invité|Gast hinzufügen
select|Markeer gast als artiest|Mark guest as artist|Marquer invité comme artiste|Gast als Künstler markieren
number|Ken guestspots toe|Assign guest spots|Attribuer des places invité|Gästeplätze zuweisen
upload|Importeer een fictief guestlistdocument|Import fictional guest-list document|Importer un document fictif de guestlist|Fiktives Gästelistendokument importieren
inspect|Controleer dubbele vermeldingen|Review duplicate guests|Vérifier les doublons|Doppelte Einträge prüfen
message|Stuur artiestenaankomst naar backstage|Notify backstage of artist arrival|Notifier Backstage de l’arrivée de l’artiste|Backstage über Künstlerankunft informieren
`,
operations:`
inspect|Bekijk actieve personeelsklokken|Review active staff clocks|Voir les chronomètres du personnel|Aktive Personaluhrzeiten ansehen
inspect|Bekijk de werkplekindeling|Review workplace allocation|Voir la répartition des postes|Arbeitsplatzverteilung ansehen
inspect|Controleer dienst- en pauzestatus|Review work and break status|Vérifier les statuts travail/pause|Arbeits- und Pausenstatus prüfen
select|Open een ingediende urenstaat|Select submitted timesheet|Sélectionner une feuille soumise|Eingereichten Stundenzettel auswählen
message|Geef correctiereden op|Record correction reason|Indiquer le motif de correction|Korrekturgrund eingeben
number|Pas een fictieve uurwaarde aan|Correct fictional hours|Corriger des heures fictives|Fiktive Stunden korrigieren
toggle|Keur de gecorrigeerde uren goed|Approve corrected hours|Approuver les heures corrigées|Korrigierte Stunden genehmigen
toggle|Vergrendel een goedgekeurde urenstaat|Lock approved timesheet|Verrouiller une feuille approuvée|Genehmigten Stundenzettel sperren
select|Kies het overtimetarief|Choose overtime rule|Choisir la règle d’heures supplémentaires|Überstundenregel wählen
number|Stel de dagelijkse drempel in|Set daily threshold|Définir le seuil quotidien|Tagesschwelle festlegen
number|Stel de wekelijkse drempel in|Set weekly threshold|Définir le seuil hebdomadaire|Wochenschwelle festlegen
`,
incidents:`
inspect|Bekijk de inkomende helpvragen|Review incoming help requests|Voir les demandes d’aide|Eingehende Hilfeanfragen ansehen
select|Wijs een incident toe|Assign an incident|Attribuer un incident|Vorfall zuweisen
message|Stuur een incidentupdate|Send incident update|Envoyer une mise à jour|Vorfall-Update senden
toggle|Sluit een afgehandeld incident|Close resolved incident|Fermer un incident résolu|Bearbeiteten Vorfall schließen
`,
sales:`
inspect|Open het inkomstenoverzicht|Open revenue overview|Ouvrir le bilan des recettes|Einnahmenübersicht öffnen
inspect|Bekijk merchinkomsten|Review merchandise revenue|Voir les recettes merchandising|Merch-Einnahmen prüfen
inspect|Bekijk kassa-inkomsten|Review till revenue|Voir les recettes de caisse|Kasseneinnahmen prüfen
inspect|Bekijk tokenomzet|Review token revenue|Voir le chiffre d’affaires jetons|Tokenumsatz prüfen
number|Voer een fictieve merchverkoop in|Enter fictional merch sale|Saisir une vente merchandising fictive|Fiktiven Merchverkauf eingeben
number|Voer een fictieve tokenverkoop in|Enter fictional token sale|Saisir une vente de jetons fictive|Fiktiven Tokenverkauf eingeben
inspect|Controleer de omzet per evenement|Review revenue by event|Vérifier les recettes par événement|Einnahmen je Event prüfen
inspect|Controleer omzetverschillen|Review revenue discrepancies|Vérifier les écarts de recettes|Einnahmendifferenzen prüfen
inspect|Bekijk de exporteerbare rapporten|Review exportable reports|Voir les rapports exportables|Exportierbare Berichte ansehen
`,
chat:`
inspect|Bekijk organisatorische groepsrechten|Review group permissions|Vérifier les droits de groupe|Gruppenberechtigungen prüfen
select|Beheer deelnemers van een fictieve chat|Manage fictional chat participants|Gérer les participants du chat fictif|Teilnehmer eines fiktiven Chats verwalten
message|Verstuur een aankondiging naar crew|Send crew announcement|Envoyer annonce à l’équipe|Crew-Ankündigung senden
`,
exports:`
select|Kies een evenement voor export|Select event for export|Choisir événement pour l’export|Event für Export wählen
inspect|Controleer de goedgekeurde uren|Review approved hours|Vérifier les heures approuvées|Genehmigte Stunden prüfen
inspect|Controleer gelockte uren|Review locked hours|Vérifier les heures verrouillées|Gesperrte Stunden prüfen
select|Kies het exportformaat|Choose export format|Choisir le format d’export|Exportformat wählen
schedule|Selecteer een datumbereik|Select date range|Sélectionner une plage de dates|Zeitraum auswählen
toggle|Maak een fictieve export klaar|Prepare fictional export|Préparer un export fictif|Fiktiven Export vorbereiten
inspect|Controleer de kolommen en totalen|Review export columns and totals|Vérifier colonnes et totaux|Exportspalten und Summen prüfen
`,
platform:`
inspect|Open het platformbeheer|Open platform management|Ouvrir la gestion de la plateforme|Plattformverwaltung öffnen
inspect|Bekijk automatiseringen|Review automations|Voir les automatisations|Automatisierungen ansehen
form|Maak een fictieve automatisering|Create fictional automation|Créer une automatisation fictive|Fiktive Automatisierung erstellen
select|Kies een automatische trigger|Choose automation trigger|Choisir déclencheur automatique|Automatisierungstrigger wählen
inspect|Bekijk briefing- en berichttemplates|Review briefing and message templates|Voir les modèles de briefing et message|Briefing- und Nachrichtenvorlagen ansehen
form|Maak een fictieve template aan|Create fictional template|Créer un modèle fictif|Fiktive Vorlage erstellen
inspect|Bekijk de QR-instellingen|Review QR settings|Voir les paramètres QR|QR-Einstellungen ansehen
inspect|Controleer toegangsrechten|Review access rules|Vérifier les droits d’accès|Zugriffsregeln prüfen
inspect|Bekijk foutmeldingen en auditlogs|Review error reports and audit logs|Voir les erreurs et journaux d’audit|Fehlerberichte und Auditprotokolle ansehen
inspect|Bekijk herstel en recovery|Review recovery configuration|Voir la configuration de récupération|Recovery-Konfiguration ansehen
inspect|Bekijk release- en rolloutstatus|Review releases and rollouts|Voir versions et déploiements|Releases und Rollouts prüfen
toggle|Simuleer een veilige rollout|Simulate safe rollout|Simuler un déploiement sûr|Sicheren Rollout simulieren
`,
settings:`
inspect|Bekijk rol- en rechteninstellingen|Review role and permission settings|Voir les droits et rôles|Rollen- und Rechteinstellungen prüfen
inspect|Bekijk AI-assistent voor Admin|Review Admin AI assistant|Voir l’assistant IA Admin|Admin-KI-Assistent ansehen
message|Stel een fictieve vraag aan AI|Ask fictional AI question|Poser une question fictive à l’IA|Fiktive Frage an KI stellen
inspect|Controleer beheernotificaties|Review administration notifications|Vérifier les notifications d’administration|Verwaltungsbenachrichtigungen prüfen
`,
timesheet:`
inspect|Bekijk ingediende urenstaten|Review submitted timesheets|Voir les feuilles d’heures soumises|Eingereichte Stundenzettel ansehen
select|Kies een ingediende urenstaat|Select submitted timesheet|Choisir une feuille soumise|Eingereichten Stundenzettel wählen
toggle|Keur een fictieve urenstaat goed|Approve fictional timesheet|Approuver une feuille fictive|Fiktiven Stundenzettel genehmigen
message|Motiveer een afkeuring|Provide rejection reason|Motiver un refus|Ablehnung begründen
toggle|Simuleer een afkeuring|Simulate rejection|Simuler un refus|Ablehnung simulieren
toggle|Vergrendel goedgekeurde uren|Lock approved hours|Verrouiller les heures approuvées|Genehmigte Stunden sperren
inspect|Controleer het auditspoor|Review audit trail|Consulter la piste d’audit|Auditspur prüfen
`
},
responsible_lead:{
overview:`
inspect|Bekijk je toegewezen werkplek|Review assigned workplace|Voir votre poste attribué|Zugewiesenen Arbeitsplatz ansehen
inspect|Controleer wie aanwezig is|Review team presence|Vérifier les présences|Teamanwesenheit prüfen
inspect|Bekijk timers van de ploeg|Review team timers|Voir les chronomètres de l’équipe|Teamtimer ansehen
inspect|Bekijk binnengekomen hulpvragen|Review team help requests|Voir les demandes d’aide|Hilfeanfragen des Teams prüfen
`,
events:`
inspect|Bekijk de crewbeschikbaarheid van je werkplek|Review workplace staff availability|Voir la disponibilité de votre équipe|Verfügbarkeit deines Teams ansehen
inspect|Controleer afzeggingen en vervangers|Review cancellations and replacements|Vérifier les annulations et remplacements|Absagen und Ersatz prüfen
message|Stuur een bericht naar de toegewezen ploeg|Message assigned crew|Envoyer un message à l’équipe|Zugewiesene Crew anschreiben
`,
workplaces:`
inspect|Open je personeelsindeling|Open team assignment|Ouvrir l’affectation de l’équipe|Teamzuweisung öffnen
select|Kies een medewerker binnen je werkplek|Select team member|Choisir un membre de votre poste|Teammitglied auswählen
inspect|Bekijk overlappende shifts|Review overlapping shifts|Vérifier les shifts qui se chevauchent|Überschneidende Schichten prüfen
toggle|Bevestig aanwijzing van een medewerker|Confirm employee check-in|Confirmer le pointage d’un membre|Mitarbeiter-Check-in bestätigen
message|Stuur werkplekinstructie naar de ploeg|Send workplace instruction|Envoyer consigne au poste|Arbeitsplatzanweisung senden
`,
briefings:`
form|Maak een briefing voor je eigen werkplek|Create your workplace briefing|Créer le briefing de votre poste|Briefing für eigenen Arbeitsplatz erstellen
write|Voeg een instructie toe|Add instruction|Ajouter une consigne|Anweisung hinzufügen
toggle|Bevestig de teambriefing|Confirm team briefing|Confirmer le briefing d’équipe|Team-Briefing bestätigen
inspect|Bekijk wie heeft bevestigd|Review acknowledgement status|Voir les confirmations|Bestätigungsstatus prüfen
message|Herinner ploeg aan briefing|Remind team about briefing|Rappeler le briefing à l’équipe|Team an Briefing erinnern
`,
operations:`
toggle|Bevestig aanwijzing van personeelslid|Confirm staff check-in|Confirmer pointage de personnel|Mitarbeiter-Check-in bestätigen
toggle|Start je eigen werktimer|Start your work timer|Démarrer votre chronomètre|Eigenen Arbeitstimer starten
toggle|Start verplichte pauze|Start required break|Démarrer la pause obligatoire|Pflichtpause starten
toggle|Beëindig verplichte pauze|End required break|Terminer la pause obligatoire|Pflichtpause beenden
inspect|Controleer pauzereminder|Review break reminder|Vérifier le rappel de pause|Pausenerinnerung prüfen
inspect|Bekijk actieve ploeguren|Review active team hours|Voir les heures de l’équipe|Aktive Teamstunden ansehen
message|Geef een uurcorrectie met reden op|Submit hours correction reason|Indiquer motif de correction|Stundenkorrektur begründen
toggle|Stop je eigen werktimer|Stop your work timer|Arrêter votre chronomètre|Eigenen Arbeitstimer stoppen
`,
tasks:`
form|Maak een taak voor je werkplek|Create task for your workplace|Créer tâche pour votre poste|Aufgabe für eigenen Arbeitsplatz erstellen
write|Beschrijf de taak|Describe task|Décrire la tâche|Aufgabe beschreiben
select|Wijs één of meerdere medewerkers toe|Assign team members|Attribuer des équipiers|Teammitglieder zuweisen
select|Wijzig een taakprioriteit|Change task priority|Changer la priorité|Aufgabenpriorität ändern
inspect|Controleer de taakstatus|Review task progress|Voir la progression|Aufgabenfortschritt prüfen
`,
inventory:`
inspect|Controleer de opstartinventaris|Review opening inventory|Vérifier l’inventaire d’ouverture|Startinventar prüfen
select|Markeer een artikel als beschadigd|Flag damaged item|Marquer un article endommagé|Beschädigten Artikel markieren
message|Meld een tekort aan Admin|Report shortage to Admin|Signaler un manque à Admin|Fehlbestand an Admin melden
toggle|Bevestig de opstartchecklist|Confirm opening checklist|Confirmer la checklist d’ouverture|Start-Checkliste bestätigen
toggle|Bevestig de afsluitchecklist|Confirm closing checklist|Confirmer la checklist de fermeture|Abschluss-Checkliste bestätigen
`,
guestlist:`
inspect|Bekijk artiestenstatus voor Backstage|Review artist arrival status|Voir les arrivées artistes|Künstlerankunft prüfen
message|Informeer de werkplek over aankomst|Notify workplace of arrival|Informer le poste de l’arrivée|Arbeitsplatz über Ankunft informieren
`,
incidents:`
inspect|Open hulpvragen van eigen werkplek|View workplace help requests|Voir demandes d’aide de votre poste|Hilfeanfragen eigener Arbeitsplatz ansehen
message|Beantwoord een hulpvraag|Reply to help request|Répondre à une demande d’aide|Hilfeanfrage beantworten
select|Escaleren naar Admin|Escalate to Admin|Escalader vers Admin|An Admin eskalieren
toggle|Markeer incident afgehandeld|Mark incident resolved|Marquer l’incident résolu|Vorfall als erledigt markieren
`,
crew:`
inspect|Bekijk de ploeglijst van je post|View your team list|Voir l’équipe de votre poste|Eigenes Team ansehen
message|Neem contact op met een teamlid|Contact team member|Contacter un membre de l’équipe|Teammitglied kontaktieren
`,
settings:`
inspect|Controleer bevoegdheden van de verantwoordelijke|Review lead permissions|Vérifier les droits du responsable|Rechte der Verantwortlichen prüfen
`,
timesheet:`
toggle|Controleer je eigen urenstaat|Review your timesheet|Vérifier votre feuille d’heures|Eigenen Stundenzettel prüfen
message|Vraag een uurcorrectie aan|Request hours correction|Demander une correction d’heures|Stundenkorrektur beantragen
toggle|Dien je eigen urenstaat in|Submit your timesheet|Soumettre votre feuille d’heures|Eigenen Stundenzettel einreichen
`
},
employee:{
overview:`
inspect|Bekijk je geplande shift|View your scheduled shift|Voir votre shift prévu|Geplante Schicht ansehen
inspect|Controleer je meldingen|Review your notifications|Consulter vos notifications|Benachrichtigungen prüfen
`,
events:`
select|Meld jezelf aan voor een evenement|Join an event|S’inscrire à un événement|Für Event anmelden
toggle|Simuleer de wachtlijst|Try the waiting list|Essayer la liste d’attente|Warteliste simulieren
inspect|Controleer bericht bij vrijgekomen plek|Review open-slot notification|Voir notification de place libre|Benachrichtigung freier Platz prüfen
`,
workplaces:`
inspect|Controleer je werkplekvoorkeur|Review preferred workplace|Vérifier votre poste préféré|Bevorzugten Arbeitsplatz prüfen
select|Kies een fictieve voorkeurswerkplek|Choose preferred workplace|Choisir un poste préféré|Bevorzugten Arbeitsplatz auswählen
inspect|Controleer je toegewezen shift|Review your assigned shift|Vérifier votre shift attribué|Zugewiesene Schicht prüfen
`,
briefings:`
inspect|Open de volledige briefingtekst|Open full briefing text|Ouvrir le texte complet|Vollständigen Briefingtext öffnen
toggle|Bevestig de briefing|Acknowledge briefing|Confirmer le briefing|Briefing bestätigen
`,
operations:`
toggle|Vraag aanwijzing bij verantwoordelijke|Request lead check-in|Demander pointage au responsable|Check-in beim Verantwortlichen anfordern
inspect|Controleer bevestiging van aanwijzing|Review check-in confirmation|Vérifier la confirmation de pointage|Check-in-Bestätigung prüfen
toggle|Start werk|Start work|Démarrer le travail|Arbeit starten
toggle|Start pauze|Start break|Démarrer la pause|Pause starten
inspect|Controleer pauzetimer en herinnering|Review break timer and reminder|Vérifier chrono et rappel de pause|Pausentimer und Erinnerung prüfen
toggle|Stop pauze|End break|Terminer la pause|Pause beenden
toggle|Stop werk|Stop work|Arrêter le travail|Arbeit beenden
`,
tasks:`
toggle|Start een toegewezen taak|Start assigned task|Démarrer tâche attribuée|Zugewiesene Aufgabe starten
message|Meld een probleem met taak|Report issue with task|Signaler un problème de tâche|Aufgabenproblem melden
`,
inventory:`
inspect|Bekijk materialen voor je shift|Review shift equipment|Voir matériel de votre shift|Schichtmaterial ansehen
message|Meld ontbrekend materiaal|Report missing equipment|Signaler matériel manquant|Fehlendes Material melden
`,
guestlist:`
write|Zoek artiest via gastenlijst|Search artist in guest list|Rechercher artiste dans la liste|Künstler in Gästeliste suchen
toggle|Bevestig artiestenaanwezigheid|Confirm artist presence|Confirmer la présence de l’artiste|Künstleranwesenheit bestätigen
`,
crew:`
inspect|Bekijk de contactgegevens van leidinggevende|Review lead contact information|Voir les coordonnées du responsable|Kontaktdaten des Verantwortlichen ansehen
`,
timesheet:`
toggle|Controleer je werk- en pauzeuren|Review work and break hours|Vérifier les heures et les pauses|Arbeits- und Pausenzeiten prüfen
message|Vraag een correctie aan|Request correction|Demander correction|Korrektur beantragen
toggle|Dien de demo-urenstaat in|Submit demo timesheet|Soumettre la feuille d’heures démo|Demo-Stundenzettel einreichen
`
}}
function parse(chapter:string,group:string,raw:string):PracticeOperation[]{
  return (raw||"").split("\n").map(v=>v.trim()).filter(Boolean).map((line,index)=>{
    const [kind,nl,en,fr,de]=line.split("|")
    if(!kind||!nl||!en||!fr||!de)throw Error("Incomplete four-language training action: "+chapter+" "+line)
    const title=c(nl,en,fr,de)
    const help=c("Voer deze handeling zelf uit in de fictieve trainingsomgeving: "+nl+". De bevestiging wordt pas opgeslagen na jouw invoer.",
      "Perform this operation yourself in the fictional training environment: "+en+". Only your input is recorded.",
      "Effectuez vous-même cette opération dans l’espace fictif : "+fr+". Seule votre saisie est enregistrée.",
      "Führe diese Handlung selbst in der fiktiven Trainingsumgebung aus: "+de+". Nur deine Eingabe wird protokolliert.")
    return {id:chapter+":"+group+":"+index,kind:kind as PracticeKind,title,help}
  })
}
export function getTrainingOperations(role:TourRole,chapter:Chapter):PracticeOperation[]{
  return [...parse(chapter,"shared",SHARED[chapter]||""),...parse(chapter,role,ROLE[role][chapter]||"")]
}
export function practiceDoneKey(progressKey:string){return progressKey+":actions-v1"}
export type PracticeEvidence={value:string;at:string;kind:PracticeKind}
export type PracticeLedger=Record<string,PracticeEvidence>
export function readPracticeLedger(key:string):PracticeLedger{
  if(typeof window==="undefined")return {}
  try{const raw=JSON.parse(localStorage.getItem(practiceDoneKey(key))||"{}") as PracticeLedger
    return raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{}
  }catch{return {}}
}
export function isChapterPractised(progressKey:string,role:TourRole,chapter:string){
  const required=getTrainingOperations(role,chapter)
  if(!required.length)return false
  const evidence=readPracticeLedger(progressKey)
  return required.every(step=>Boolean(evidence[step.id]?.value&&evidence[step.id]?.at))
}
export function countRoleOperations(role:TourRole,chapters:readonly {key:string}[]){
  return chapters.reduce((sum,chapter)=>sum+getTrainingOperations(role,chapter.key).length,0)
}
