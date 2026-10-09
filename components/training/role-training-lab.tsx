"use client"

import {useEffect,useMemo,useRef,useState} from "react"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTrainingOperations,practiceDoneKey,readPracticeLedger,isChapterPractised,type PracticeOperation,type PracticeLedger} from "@/lib/training-exercise-catalog"
import {TOUR_CHAPTERS,type TourRole,type TourCopy} from "@/lib/tour-training"
import {demoScenarioFromLedger} from "@/lib/training-demo-scenario"
import {trainingOperationalState,trainingOperationError} from "@/lib/training-operational-state"

const c=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])
const EXAMPLES:Record<string,TourCopy>={
 overview:{nl:"Demo Night · Leuven · 20:00–04:00 · vier actieve werkplekken · 12/20 crew · 2 ploegmeldingen.",en:"Demo Night · Leuven · 20:00–04:00 · four active workplaces · 12/20 crew · two staff alerts.",fr:"Demo Night · Louvain · 20:00–04:00 · quatre postes actifs · 12/20 équipiers · deux notifications.",de:"Demo Night · Leuven · 20:00–04:00 · vier aktive Arbeitsplätze · 12/20 Crew · zwei Meldungen."},
 events:{nl:"Evenement: UpTillDawn Trainingsavond · opbouw 18:00 · deuren 20:00 · afbouw 04:00 · deadline 09/10 18:00 · wachtlijst actief.",en:"Event: UpTillDawn Training Night · setup 18:00 · doors 20:00 · teardown 04:00 · deadline 09/10 18:00 · waiting list active.",fr:"Événement : Soirée d’entraînement UpTillDawn · montage 18 h · portes 20 h · démontage 04 h · date limite 09/10 18 h · liste d’attente active.",de:"Event: UpTillDawn Trainingsabend · Aufbau 18:00 · Einlass 20:00 · Abbau 04:00 · Anmeldefrist 09.10. 18:00 · Warteliste aktiv."},
 workplaces:{nl:"Main Bar · Lina Peeters (verantwoordelijke) · 4/5 crew · 20:00–04:00. Merch, Tokens, Entrance, Backstage en Driver zijn ook beschikbaar.",en:"Main Bar · Lina Peeters (responsible) · 4/5 crew · 20:00–04:00. Merch, Tokens, Entrance, Backstage and Driver are also available.",fr:"Bar principal · Lina Peeters (responsable) · 4/5 équipiers · 20 h–04 h. Merch, Jetons, Entrée, Backstage et Chauffeur sont également disponibles.",de:"Hauptbar · Lina Peeters (verantwortlich) · 4/5 Crew · 20:00–04:00. Merch, Tokens, Eingang, Backstage und Fahrer sind auch verfügbar."},
 briefings:{nl:"Briefing Main Bar: controleer prijzen, open twee kassa’s, controleer voldoende wisselgeld, vul water aan en meld incidenten direct. Er zijn 3/4 leesbevestigingen.",en:"Main Bar briefing: check prices, open two tills, verify cash float, refill water and report incidents immediately. Three of four people acknowledged.",fr:"Briefing Bar principal : vérifier les prix, ouvrir deux caisses, contrôler la monnaie, réapprovisionner l’eau et signaler immédiatement les incidents. 3/4 confirmations.",de:"Hauptbar-Briefing: Preise prüfen, zwei Kassen öffnen, Wechselgeld kontrollieren, Wasser auffüllen und Vorfälle sofort melden. 3/4 Lesebestätigungen."},
 operations:{nl:"Crew: Lina werkt sinds 20:00; Noah pauzeert 00:00–01:00; Mila wacht op aanwijzing. Verplichte pauze: 1 uur. Correcties worden geaudit.",en:"Crew: Lina working since 20:00; Noah on break 00:00–01:00; Mila awaiting check-in. Mandatory break: one hour. Corrections are audited.",fr:"Équipe : Lina travaille depuis 20 h ; Noah en pause de 00 h à 01 h ; Mila attend le pointage. Pause obligatoire : une heure. Corrections auditées.",de:"Crew: Lina arbeitet seit 20:00; Noah Pause 00:00–01:00; Mila wartet auf Check-in. Pflichtpause: eine Stunde. Korrekturen protokolliert."},
 driver:{nl:"Driver: artiest DJ Nova · ophaaladres Leuven Station · ETA 21:35 · herinnering 21:20. Eventuren stoppen tijdens het rijden; kilometers en Backstage-aankomst worden geregistreerd.",en:"Driver: DJ Nova · pickup Leuven Station · ETA 21:35 · reminder 21:20. Event hours pause during driving; mileage and Backstage arrival are recorded.",fr:"Chauffeur : DJ Nova · prise en charge gare de Louvain · ETA 21 h 35 · rappel 21 h 20. Les heures d’événement sont suspendues pendant la conduite ; kilomètres et arrivée Backstage enregistrés.",de:"Fahrer: DJ Nova · Abholung Bahnhof Leuven · ETA 21:35 · Erinnerung 21:20. Eventzeit pausiert während der Fahrt; Kilometer und Backstage-Ankunft werden protokolliert."},
 tasks:{nl:"Taak: koelcel aanvullen. Instructie: 12 bakken water en 4 dozen bekers halen. Deadline 22:15. Toegewezen: Lina en Noah. Status: bezig.",en:"Task: restock cold room. Instructions: fetch 12 crates of water and four boxes of cups. Deadline 22:15. Assigned: Lina and Noah. Status: in progress.",fr:"Tâche : réapprovisionner la chambre froide. Instruction : prendre 12 caisses d’eau et quatre boîtes de gobelets. Échéance 22 h 15. Affectés : Lina et Noah. En cours.",de:"Aufgabe: Kühlraum auffüllen. Anweisung: 12 Kisten Wasser und vier Kartons Becher holen. Frist 22:15. Zugewiesen: Lina und Noah. Status: in Arbeit."},
 incidents:{nl:"Incident DEMO-004: kassaterminal 2 reageert niet · locatie Main Bar · prioriteit dringend · coördinaten geregistreerd · toegewezen aan Lina.",en:"Incident DEMO-004: till terminal 2 unresponsive · Main Bar · priority urgent · coordinates recorded · assigned to Lina.",fr:"Incident DEMO-004 : terminal de caisse 2 sans réponse · Bar principal · priorité urgente · coordonnées enregistrées · attribué à Lina.",de:"Vorfall DEMO-004: Kassenterminal 2 reagiert nicht · Hauptbar · Priorität dringend · Koordinaten gespeichert · Lina zugewiesen."},
 inventory:{nl:"Main Bar: 480/500 bekers, 12/15 bakken water, 2/2 scanners, 3/4 barmatten. Eén barmat ontbreekt; verantwoordelijke meldt dit bij opening én sluiting.",en:"Main Bar: 480/500 cups, 12/15 crates of water, two of two scanners, three of four bar mats. One mat is missing; the lead reports it at opening and closing.",fr:"Bar principal : 480/500 gobelets, 12/15 caisses d’eau, 2/2 scanners, 3/4 tapis de bar. Un tapis manque ; signalement à l’ouverture et à la fermeture.",de:"Hauptbar: 480/500 Becher, 12/15 Wasserkisten, 2/2 Scanner, 3/4 Barmatten. Eine Matte fehlt; Meldung bei Start und Abschluss."},
 guestlist:{nl:"Guestlist: Amelie Vos (guest, 2 spots, binnen), DJ Nova (artiest, 3 spots, verwacht 21:35). Bij aankomst artiest krijgt Backstage onmiddellijk een melding.",en:"Guest list: Amelie Vos (guest, two spots, arrived), DJ Nova (artist, three spots, expected 21:35). Backstage is notified immediately on artist arrival.",fr:"Liste invités : Amelie Vos (invitée, deux places, arrivée), DJ Nova (artiste, trois places, attendu à 21 h 35). Backstage est averti à l’arrivée.",de:"Gästeliste: Amelie Vos (Gast, zwei Plätze, angekommen), DJ Nova (Künstler, drei Plätze, erwartet 21:35). Backstage wird bei Ankunft informiert."},
 sales:{nl:"Omzet Training Night: kassa/tokens €900,00 · merch €384,50 · totaal €1.284,50. Alleen fictieve bedragen wijzigen tijdens de training.",en:"Training Night revenue: till/tokens €900.00 · merch €384.50 · total €1,284.50. Only fictional values change during training.",fr:"Recettes de la soirée démo : caisse/jetons 900,00 € · merchandising 384,50 € · total 1 284,50 €. Seules les données fictives changent.",de:"Trainingsabend-Umsatz: Kasse/Tokens 900,00 € · Merch 384,50 € · Gesamt 1.284,50 €. Nur fiktive Werte ändern sich."},
 personnel:{nl:"Aanvraag: Mila Vermeulen · e-mail bevestigd · rol Personeel aangevraagd · status wacht op goedkeuring. Keur uitsluitend het fictieve account goed.",en:"Request: Mila Vermeulen · email verified · requested Staff role · awaiting approval. Approve only the fictional account.",fr:"Demande : Mila Vermeulen · e-mail vérifié · rôle Personnel demandé · en attente d’approbation. Approuvez seulement le compte fictif.",de:"Anfrage: Mila Vermeulen · E-Mail bestätigt · Personalrolle angefragt · wartet auf Genehmigung. Nur fiktives Konto genehmigen."},
 crew:{nl:"Lina Peeters: verantwoordelijke Main Bar, Noah Jacobs: personeel Main Bar, Mila Vermeulen: personeelsaanvraag. Alleen Admin kan rollen en accountstatus wijzigen.",en:"Lina Peeters: Main Bar lead, Noah Jacobs: Main Bar staff, Mila Vermeulen: applicant. Only Admin can modify roles and account status.",fr:"Lina Peeters : responsable Bar principal, Noah Jacobs : équipier, Mila Vermeulen : candidate. Seul Admin peut modifier rôles et statuts.",de:"Lina Peeters: Hauptbar-Leitung, Noah Jacobs: Personal, Mila Vermeulen: Antrag. Nur Admin darf Rollen und Kontostatus ändern."},
 chat:{nl:"Eventchat: Lina: 'Koeling aangevuld.' Noah antwoordt: '@Lina, kassa 2 controleren.' Foto’s worden meteen zichtbaar; de veiligheidscontrole draait op de achtergrond.",en:"Event chat: Lina: 'Fridges restocked.' Noah replies: '@Lina, check till 2.' Photos appear immediately; security scanning runs in the background.",fr:"Chat événement : Lina : « Frigos remplis. » Noah répond : « @Lina, vérifier caisse 2. » Photos immédiatement visibles ; analyse en arrière-plan.",de:"Eventchat: Lina: 'Kühlung aufgefüllt.' Noah antwortet: '@Lina, Kasse 2 prüfen.' Fotos sofort sichtbar; Sicherheitsprüfung läuft im Hintergrund."},
 exports:{nl:"Urenexport: 10 oktober · 12 goedgekeurde urenstaten · 84 netto-uren · kolommen medewerker, werkplek, shift, pauze, overtime en status. Export is alleen demo.",en:"Time export: 10 October · 12 approved timesheets · 84 net hours · columns for staff, workplace, shift, break, overtime and status. Demo only.",fr:"Export des heures : 10 octobre · 12 feuilles approuvées · 84 heures nettes · colonnes personnel, poste, shift, pause, heures supplémentaires et statut. Démo uniquement.",de:"Stundenexport: 10. Oktober · 12 genehmigte Stundenzettel · 84 Nettostunden · Spalten Personal, Arbeitsplatz, Schicht, Pause, Überstunden, Status. Nur Demo."},
 platform:{nl:"Platformbeheer: 2 automatiseringen, 4 briefingtemplates, een QR-code voor registratie, 1 voorbeeldfoutmelding en een test-rollout. Niets wordt gepubliceerd.",en:"Platform: two automations, four briefing templates, a registration QR code, one example error report and a test rollout. Nothing is published.",fr:"Plateforme : deux automatisations, quatre modèles de briefing, un QR d’inscription, un exemple d’erreur et un déploiement test. Rien n’est publié.",de:"Plattform: zwei Automatisierungen, vier Briefingvorlagen, ein Registrierungs-QR-Code, ein Beispielfehler und ein Test-Rollout. Nichts wird veröffentlicht."},
 settings:{nl:"Taal volgt het toestel bij eerste start; de taalkeuzer toont dezelfde taal. Meldingen en PWA-installatie worden apart bevestigd. De AI-assistent is rolgebonden.",en:"On first launch, language follows the device and the selector matches. Notifications and PWA installation require separate consent. The AI assistant is role-scoped.",fr:"Au premier lancement, la langue suit l’appareil et le sélecteur correspond. Notifications et installation PWA exigent des accords distincts. L’assistant IA dépend du rôle.",de:"Beim ersten Start folgt die Sprache dem Gerät und die Auswahl stimmt überein. Push und PWA-Installation benötigen separate Zustimmung. KI-Assistenz ist rollenabhängig."},
 help:{nl:"Help bevat functiehandleidingen, opnieuw starten van tours, Android/iOS/Windows installatie-instructies, QR-toegang en uitleg over camerarechten, GPS en meldingen.",en:"Help includes feature guides, tour restart, Android/iOS/Windows installation instructions, QR access and explanations of camera, GPS and notification permissions.",fr:"Aide : guides fonctionnels, redémarrage des visites, installation Android/iOS/Windows, accès QR et explications des autorisations caméra, GPS et notifications.",de:"Hilfe: Funktionsanleitungen, Tour-Neustart, Installation für Android/iOS/Windows, QR-Zugang und Kamera-, GPS- sowie Benachrichtigungsrechte."},
 timesheet:{nl:"Voorbeeldurenstaat: 20:00–04:00 · pauze 00:00–01:00 · netto 7 uur. Status loopt van open via ingediend en goedgekeurd naar vergrendeld. Afwijzing vereist reden.",en:"Example timesheet: 20:00–04:00 · break 00:00–01:00 · seven net hours. Status goes from open through submitted and approved to locked. Rejection requires a reason.",fr:"Feuille exemple : 20 h–04 h · pause 00 h–01 h · sept heures nettes. Statuts : ouverte, soumise, approuvée, verrouillée. Refus motivé obligatoire.",de:"Beispiel-Stundenzettel: 20:00–04:00 · Pause 00:00–01:00 · sieben Nettostunden. Status: offen, eingereicht, genehmigt, gesperrt. Ablehnung mit Begründung."}
}

const FULL_INSTRUCTIONS:Record<"briefings"|"tasks",readonly TourCopy[]>={
 briefings:[
 {nl:"Event: UpTillDawn Trainingsavond, Leuven. Opbouw 18:00, deuren 20:00, sluiting 04:00. Verantwoordelijke Lina Peeters. Meld je bij haar aan en controleer je shift en de toegang tot je werkplek.",en:"Event: UpTillDawn Training Night, Leuven. Setup 18:00, doors 20:00, closure 04:00. Responsible lead Lina Peeters. Check in with her and review your shift and workplace access.",fr:"Événement : Soirée UpTillDawn, Louvain. Montage 18 h, ouverture 20 h, fermeture 04 h. Responsable Lina Peeters. Présentez-vous et vérifiez votre service et vos accès.",de:"Event: UpTillDawn Trainingsabend, Leuven. Aufbau 18:00, Einlass 20:00, Ende 04:00. Verantwortliche Lina Peeters. Melde dich an und prüfe Schicht und Arbeitsplatzzugang."},
 {nl:"OPSTART: controleer koeling, inventaris, prijslijst, kassa, scanners en wisselgeld. Meld tekorten of defecten onmiddellijk. Controleer de checklist, de taakverdeling en de toegewezen ploeg.",en:"OPENING: check refrigeration, inventory, prices, till, scanners and cash float. Report shortages or damage immediately. Review the checklist, task assignment and team.",fr:"OUVERTURE : vérifier réfrigération, stock, prix, caisse, scanners et fonds de caisse. Signaler tout manque ou dommage. Contrôler la checklist, les tâches et l’équipe.",de:"START: Kühlung, Bestand, Preise, Kasse, Scanner und Wechselgeld prüfen. Fehlbestände oder Schäden sofort melden. Checkliste, Aufgaben und Team prüfen."},
 {nl:"VEILIGHEID: houd nooduitgangen vrij. Bij gevaar of een defect druk je op HELP en meld je het aan de verantwoordelijke. Pauze: één verplicht uur, apart registreren met Start pauze en Stop pauze. Tijdens een Driver-rit lopen de eventuren niet.",en:"SAFETY: keep exits clear. Use HELP to report hazards or defects to the responsible lead. Break: one mandatory hour, tracked with Start break and End break. During Driver trips the event timer is paused.",fr:"SÉCURITÉ : dégager les issues. Utiliser AIDE pour signaler dangers et défauts. Pause : une heure obligatoire à enregistrer avec Début et Fin de pause. Le temps événement s’arrête durant les trajets Driver.",de:"SICHERHEIT: Ausgänge freihalten. Gefahren und Defekte über HILFE melden. Pause: eine Pflichtstunde mit Pause starten und beenden erfassen. Während Fahrerfahrten ruht die Eventzeit."},
 {nl:"AFSLUITING: tel de voorraad en kassa, meld schade en tekorten, sluit taken en inventarischecklists. Stop werk en dien je urenstaat alleen in na het afronden van alle verplichte modules en het controleren van pauzes en correcties.",en:"CLOSING: recount stock and till, report damage and shortages, close tasks and inventory checklists. Stop work and submit your timesheet only after all mandatory modules and after checking breaks and corrections.",fr:"FERMETURE : recompter stocks et caisse, signaler dommages et manques, terminer tâches et checklists. Arrêter le travail et soumettre les heures après tous les modules et contrôle des pauses et corrections.",de:"ENDE: Bestand und Kasse zählen, Schäden melden, Aufgaben und Inventarlisten abschließen. Arbeit beenden und Stundenzettel erst nach allen Pflichtmodulen sowie Prüfung der Pausen und Korrekturen einreichen."}
 ],
 tasks:[
 {nl:"Taak: koelruimte aanvullen voor 22:15. Verantwoordelijke Lina Peeters. Toegewezen aan Noah en Mila. Haal 12 bakken water en 4 dozen bekers en controleer de leverbon.",en:"Task: restock the cold room by 22:15. Responsible lead Lina Peeters. Assigned to Noah and Mila. Fetch 12 crates of water and 4 boxes of cups and verify the delivery sheet.",fr:"Tâche : remplir la réserve avant 22 h 15. Responsable Lina Peeters. Attribuée à Noah et Mila. Apporter 12 caisses d’eau et 4 boîtes de gobelets, vérifier le bon.",de:"Aufgabe: Kühlraum bis 22:15 füllen. Verantwortliche Lina Peeters. Noah und Mila zugewiesen. 12 Wasserkisten und 4 Kartons Becher holen, Lieferschein prüfen."},
 {nl:"Bij tekorten: schrijf een taakopmerking, markeer ontbrekende inventaris en waarschuw de verantwoordelijke. Start de taak en markeer ze pas voltooid nadat het werk werkelijk in de demo is uitgevoerd.",en:"If stock is missing: comment on the task, mark missing inventory and notify the lead. Start the task and mark it complete only after you have performed the demo work.",fr:"Si du stock manque : commenter la tâche, signaler le manque dans l’inventaire et prévenir le responsable. Démarrer et terminer la tâche seulement après l’action dans la démo.",de:"Bei Fehlbestand: Aufgabe kommentieren, Inventar als fehlend markieren und Verantwortliche informieren. Aufgabe erst nach Durchführung der Demoarbeit abschließen."}
 ]
}
function optionsFor(step:PracticeOperation):{value:string;label:TourCopy}[]{
 const name=step.title.nl.toLowerCase()
 const item=(value:string,nl:string,en:string,fr:string,de:string)=>({value,label:{nl,en,fr,de}})
 // A role operation must choose the entity it describes, not a generic workplace.
 const people=[item("lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"),item("noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"),item("mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen")]
 if(["workplaces:admin:2","workplaces:admin:4","workplaces:admin:5","workplaces:admin:8","workplaces:responsible_lead:1","tasks:admin:3","tasks:responsible_lead:2","chat:shared:4","chat:admin:1"].includes(step.id))return people
 if(["guestlist:shared:2","guestlist:admin:2"].includes(step.id))return [item("guest","Gast","Guest","Invité","Gast"),item("artist","Artiest","Artist","Artiste","Künstler")]
 if(["inventory:shared:4","inventory:responsible_lead:1"].includes(step.id))return [item("good","In orde","Good","En bon état","In Ordnung"),item("missing","Ontbreekt","Missing","Manquant","Fehlt"),item("damaged","Beschadigd","Damaged","Endommagé","Beschädigt")]
 if(step.id==="tasks:responsible_lead:3")return [item("normal","Normaal","Normal","Normal","Normal"),item("high","Hoog","High","Élevée","Hoch"),item("urgent","Dringend","Urgente","Urgente","Dringend")]
 if(["operations:admin:3","timesheet:admin:1"].includes(step.id))return [item("noah-timesheet","Noah Jacobs · urenstaat","Noah Jacobs · timesheet","Noah Jacobs · feuille d’heures","Noah Jacobs · Stundenzettel"),item("lina-timesheet","Lina Peeters · urenstaat","Lina Peeters · timesheet","Lina Peeters · feuille d’heures","Lina Peeters · Stundenzettel")]
 if(["events:shared:3","events:shared:4","events:shared:5"].includes(step.id))return [item("yes","IK KAN","I CAN","JE PEUX","ICH KANN"),item("no","IK KAN NIET","I CANNOT","JE NE PEUX PAS","ICH KANN NICHT")]
 if(step.id==="events:admin:5")return [item("scheduled","Gepland","Scheduled","Prévu","Geplant"),item("active","Actief","Active","Actif","Aktiv"),item("closed","Afgesloten","Closed","Clôturé","Abgeschlossen")]
 if(step.id==="operations:admin:10")return [item("daily","Dagelijks","Daily","Journalier","Täglich"),item("weekly","Wekelijks","Weekly","Hebdomadaire","Wöchentlich")]
 if(/taal/.test(name))return [item("nl","Nederlands","Dutch","Néerlandais","Niederländisch"),item("fr","Frans","French","Français","Französisch"),item("en","Engels","English","Anglais","Englisch"),item("de","Duits","German","Allemand","Deutsch")]
 if(/rol/.test(name))return [item("employee","Personeel","Staff","Personnel","Personal"),item("responsible_lead","Verantwoordelijke","Responsible lead","Responsable","Verantwortlich"),item("admin","Admin","Admin","Admin","Admin")]
 if(/urgentie/.test(name))return [item("normal","Normaal","Normal","Normal","Normal"),item("urgent","Dringend","Urgent","Urgent","Dringend"),item("critical","Kritiek","Critical","Critique","Kritisch")]
 if(/formaat/.test(name))return [item("xlsx","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)","Excel (.xlsx)"),item("csv","CSV","CSV","CSV","CSV"),item("pdf","PDF","PDF","PDF","PDF")]
 if(/incidentcategorie/.test(name))return [item("technical","Technisch","Technical","Technique","Technisch"),item("safety","Veiligheid","Safety","Sécurité","Sicherheit"),item("other","Overige","Other","Autre","Sonstige")]
 if(/status|prioriteit/.test(name))return [item("planned","Gepland","Scheduled","Planifié","Geplant"),item("active","Actief","Active","Actif","Aktiv"),item("done","Afgesloten","Closed","Clôturé","Abgeschlossen")]
 if(/medewerker|persone|persoon|deelnemer/.test(name))return [item("lina","Lina Peeters","Lina Peeters","Lina Peeters","Lina Peeters"),item("noah","Noah Jacobs","Noah Jacobs","Noah Jacobs","Noah Jacobs"),item("mila","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen","Mila Vermeulen")]
 if(/beschikbaar|opbouw|afbouw/.test(name))return [item("yes","Ik kan","I can","Je peux","Ich kann"),item("no","Ik kan niet","I cannot","Je ne peux pas","Ich kann nicht")]
 if(/overtime/.test(name))return [item("daily","Dagelijks","Daily","Journalier","Täglich"),item("weekly","Wekelijks","Weekly","Hebdomadaire","Wöchentlich")]
 return [item("bar","Bar / Toog","Bar / Counter","Bar / Comptoir","Bar / Theke"),item("merch","Merch","Merch","Merch","Merch"),item("tokens","Tokens","Tokens","Jetons","Tokens"),item("entrance","Inkom & Guestlist","Entrance & Guestlist","Entrée & Guestlist","Eingang & Gästeliste"),item("backstage","Backstage Management","Backstage Management","Gestion des coulisses","Backstage Management"),item("driver","Driver","Driver","Chauffeur","Fahrer")]
}
function getDemoState(key:string):Record<string,string>{
 try{const raw=JSON.parse(sessionStorage.getItem("uptilldawn-lab-model:"+key)||"{}");return raw&&typeof raw==="object"?raw:{}}catch{return {}}
}
function recordDemoState(key:string,id:string,value:string){
 const data=getDemoState(key)
 sessionStorage.setItem("uptilldawn-lab-model:"+key,JSON.stringify({...data,[id]:value}))
 dispatchEvent(new CustomEvent("uptilldawn-training-demo-updated",{detail:{id,value}}))
}
export function RoleTrainingLab({role,chapter,progressKey}:{role:TourRole;chapter:string;progressKey:string}){
 const operations=useMemo(()=>getTrainingOperations(role,chapter),[role,chapter])
 const [language,setLanguage]=useState<SupportedUiLocale>("nl")
 const [ledger,setLedger]=useState<PracticeLedger>({})
 const [hydrated,setHydrated]=useState(false)
 const [opened,setOpened]=useState(false)
 const [openedFor,setOpenedFor]=useState("")
 const [draftFor,setDraftFor]=useState("")
 const [textValue,setTextValue]=useState("")
 const [selected,setSelected]=useState("")
 const [acknowledged,setAcknowledged]=useState(false)
 const [firstTime,setFirstTime]=useState("")
 const [secondTime,setSecondTime]=useState("")
 const [fileName,setFileName]=useState("")
 const [error,setError]=useState("")
 const [reviewed,setReviewed]=useState(false)
 const lastCompletion=useRef("")
 const container=useRef<HTMLElement|null>(null)
 const chapterData=TOUR_CHAPTERS.find(item=>item.key===chapter)
 const currentIndex=operations.findIndex(step=>!ledger[step.id]?.value||!ledger[step.id]?.at||ledger[step.id]?.kind!==step.kind)
 const index=currentIndex<0?operations.length:currentIndex
 const current=operations[index]
 const isOpened=opened&&openedFor===current?.id
 const scenario=demoScenarioFromLedger(ledger)
 const domainStates=trainingOperationalState(role,ledger)
 const complete=operations.length>0&&operations.every(step=>Boolean(ledger[step.id]?.value&&ledger[step.id]?.at&&ledger[step.id]?.kind===step.kind))
 const options=current?optionsFor(current):[]
 useEffect(()=>{const apply=()=>setLanguage(activeUiLocale());const frame=requestAnimationFrame(apply);addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>{cancelAnimationFrame(frame);removeEventListener(LANGUAGE_APPLIED_EVENT,apply)}},[])
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
   setLedger(readPracticeLedger(progressKey))
   setHydrated(true);setOpened(false);setOpenedFor("");setDraftFor("");setTextValue("");setSelected("");setAcknowledged(false)
   setFirstTime("");setSecondTime("");setFileName("");setError("");setReviewed(false)
  })
  return()=>cancelAnimationFrame(frame)
 },[progressKey,role,chapter])
 // Inputs are reset in the same event that submits a step. A deferred
 // requestAnimationFrame reset used to erase the next step's input when users
 // or concurrent browser bots interacted before the next paint.
 useEffect(()=>{
  if(!hydrated||!complete||!isChapterPractised(progressKey,role,chapter))return
  const marker=progressKey+":"+chapter
  if(lastCompletion.current===marker)return
  lastCompletion.current=marker
  const frame=requestAnimationFrame(()=>dispatchEvent(new CustomEvent("uptilldawn-training-lab-completed",{detail:{role,chapter}})))
  return()=>cancelAnimationFrame(frame)
 },[chapter,complete,hydrated,progressKey,role])
 const execute=()=>{
  if(!current||!hydrated)return
  if(current.kind!=="inspect"&&draftFor!==current.id){
   setError(c(language,"Gebruik het actieve invoerveld of de checkbox eerst zelf.","Use the active field or checkbox yourself first.","Utilisez d’abord le champ actif ou la case à cocher.","Benutze zuerst selbst das aktive Feld oder Kontrollkästchen."));return
  }
  let value=""
  switch(current.kind){
   case "inspect":
    if(!isOpened){setError(c(language,"Open eerst de informatie.","First open the information.","Ouvrez d’abord les informations.","Öffne zuerst die Informationen."));return}
    value="reviewed";break
   case "write":case "message":
    if(textValue.trim().length<5){setError(c(language,"Vul minstens vijf tekens in.","Enter at least five characters.","Saisissez au moins cinq caractères.","Mindestens fünf Zeichen eingeben."));return}
    value=textValue.trim();break
   case "delete":
    if(textValue.trim()!=="DEMO"){setError(c(language,"Typ DEMO om veilig te bevestigen.","Type DEMO to confirm safely.","Saisissez DEMO pour confirmer.","Gib DEMO zur sicheren Bestätigung ein."));return}
    value="demo-deletion-reviewed";break
   case "form":
    if(textValue.trim().length<5||!selected){setError(c(language,"Vul de naam in en kies een categorie.","Enter a name and select a category.","Saisissez un nom et choisissez une catégorie.","Name eingeben und Kategorie wählen."));return}
    value=textValue.trim()+" · "+selected;break
   case "select":
    if(!selected){setError(c(language,"Maak eerst een keuze.","Choose an option first.","Choisissez une option.","Bitte zuerst auswählen."));return}
    value=selected;break
   case "number":
    if(!Number.isFinite(Number(textValue))||Number(textValue)<=0){setError(c(language,"Voer een positief aantal in.","Enter a positive number.","Saisissez un nombre positif.","Positive Zahl eingeben."));return}
    value=String(Number(textValue));break
   case "schedule":
    if(!firstTime||!secondTime||firstTime>=secondTime){setError(c(language,"Kies een geldig begin en einde.","Choose a valid start and end.","Choisissez un début et une fin valides.","Gültigen Beginn und Ende wählen."));return}
    value=firstTime+" → "+secondTime;break
   case "upload":
    if(!fileName){setError(c(language,"Kies een demobestand of eigen voorbeeldbestand.","Choose a demo file or your own sample.","Choisissez un fichier démo ou personnel.","Wähle eine Demo-Datei oder eigene Beispieldatei."));return}
    value=fileName;break
   case "toggle":
    if(!acknowledged){setError(c(language,"Bevestig de handeling zelf.","Confirm the action yourself.","Confirmez vous-même l’action.","Bestätige die Handlung selbst."));return}
    value="confirmed";break
  }
  if(!value)return
  const prereq=trainingOperationError(role,current,ledger)
  if(prereq){setError(prereq[language]);return}
  const entry={value,at:new Date().toISOString(),kind:current.kind}
  const next={...ledger,[current.id]:entry}
  localStorage.setItem(practiceDoneKey(progressKey),JSON.stringify(next))
  recordDemoState(progressKey,current.id,value)
  setOpened(false);setOpenedFor("");setDraftFor("");setTextValue("")
  setSelected("");setAcknowledged(false);setFirstTime("");setSecondTime("")
  setFileName("");setReviewed(false);setError("")
  setLedger(next)
  requestAnimationFrame(()=>container.current?.scrollIntoView({behavior:"smooth",block:"start"}))
 }
 const resetAll=()=>{
  // A restart is explicit; individual completed actions cannot be skipped.
  localStorage.removeItem(practiceDoneKey(progressKey))
  sessionStorage.removeItem("uptilldawn-lab-model:"+progressKey)
  lastCompletion.current=""
  setLedger({})
 }
 if(!hydrated)return null
 return <section ref={container} data-no-translate data-training-lab data-training-chapter={chapter} aria-label={c(language,"Praktische rolopleiding","Practical role training","Formation pratique par rôle","Praktisches Rollentraining")} className="mx-auto my-6 w-full max-w-5xl scroll-mt-24 rounded-2xl border border-violet-500/50 bg-card p-4 shadow-sm sm:p-6">
  <header className="space-y-2">
   <p className="text-xs font-black uppercase tracking-wider text-violet-500">{c(language,"VERPLICHTE PRAKTIJKTRAINING · FICTIEVE GEGEVENS","MANDATORY HANDS-ON TRAINING · FICTIONAL DATA","FORMATION PRATIQUE OBLIGATOIRE · DONNÉES FICTIVES","VERPFLICHTENDES PRAXISTRAINING · FIKTIVE DATEN")}</p>
   <h2 className="text-xl font-black">{chapterData?.title[language]||chapter}</h2>
   <p className="text-sm text-muted-foreground">{chapterData?.description[language]}</p>
   <div className="flex items-center gap-3 text-xs font-bold"><span>{Math.min(index,operations.length)} / {operations.length} {c(language,"handelingen uitgevoerd","actions completed","actions réalisées","Handlungen erledigt")}</span><progress className="h-2 flex-1 accent-violet-600" value={index} max={Math.max(1,operations.length)}/></div>
  </header>
  <section data-training-live-workflow className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={c(language,"Live fictieve eventworkflow","Live fictional event workflow","Flux événement fictif en direct","Live-Ablauf des fiktiven Events")}>
   {domainStates.map(row=><article key={row.domain} data-training-domain={row.domain} data-training-status={row.status} className="rounded-lg border bg-background p-3 text-sm">
     <div className="flex items-start justify-between gap-2">
       <h3 className="font-bold">{row.title[language]}</h3>
       <span className={row.status==="completed"?"rounded-full border border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-emerald-600":row.status==="active"?"rounded-full border border-amber-600 px-2 py-0.5 text-[10px] font-bold text-amber-600":"rounded-full border px-2 py-0.5 text-[10px] font-bold text-muted-foreground"}>{row.status==="completed"?c(language,"VOLTOOID","COMPLETED","TERMINÉ","ABGESCHLOSSEN"):row.status==="active"?c(language,"BEZIG","IN PROGRESS","EN COURS","IN ARBEIT"):c(language,"WACHT","PENDING","EN ATTENTE","AUSSTEHEND")}</span>
     </div>
     <p className="mt-2 text-xs text-muted-foreground">{row.detail[language]}</p>
   </article>)}
  </section>
  <section data-training-demo-state className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={c(language,"Actuele demogegevens","Current demo state","Données démo actuelles","Aktuelle Demodaten")}>
   <article className="rounded-lg border p-3 text-sm">
    <p className="text-xs font-bold text-muted-foreground">{c(language,"Evenement","Event","Événement","Event")}</p>
    <p className="mt-1 font-bold">{scenario.eventName}</p>
    <p className="text-xs text-muted-foreground">{c(language,"Maximale crew","Maximum crew","Équipe maximale","Maximale Crew")}: {scenario.crewLimit}</p>
   </article>
   <article className="rounded-lg border p-3 text-sm">
    <p className="text-xs font-bold text-muted-foreground">{c(language,"Werkplek en shift","Workplace and shift","Poste et shift","Arbeitsplatz und Schicht")}</p>
    <p className="mt-1 font-bold">{scenario.workplaceName}</p>
    <p className="text-xs text-muted-foreground">{scenario.shiftTime} · Lina Peeters</p>
   </article>
   <article className="rounded-lg border p-3 text-sm">
    <p className="text-xs font-bold text-muted-foreground">{c(language,"Briefing en taak","Briefing and task","Briefing et tâche","Briefing und Aufgabe")}</p>
    <p className="mt-1 font-bold">{scenario.briefingName}</p>
    <p className="text-xs text-muted-foreground">{scenario.taskName}</p>
   </article>
  </section>
  {current?<div data-training-kind={current.kind} data-training-operation={current.id} className="mt-5 space-y-4 rounded-xl border p-4">
   <p className="text-xs font-bold text-violet-500">{c(language,"ACTIEVE HANDELING","ACTIVE ACTION","ACTION ACTIVE","AKTIVE HANDLUNG")} {index+1}/{operations.length}</p>
   <h3 className="text-lg font-black">{current.title[language]}</h3>
   <p className="text-sm leading-6 text-muted-foreground">{current.help[language]}</p>
   {current.kind==="inspect"&&<div className="space-y-3">
     <button type="button" data-training-active-action={!isOpened?"true":undefined} onClick={()=>{setOpened(true);setOpenedFor(current.id);setReviewed(true);setError("")}} className="rounded-xl border px-4 py-3 text-sm font-bold">{current.title[language]}</button>
     {isOpened&&<article className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm leading-6"><p className="font-bold">{current.title[language]}</p><p>{current.help[language]}</p><p className="mt-2 text-muted-foreground">{EXAMPLES[chapter]?.[language]}</p></article>}
     {reviewed&&isOpened&&<button type="button" data-training-active-action onClick={execute} className="rounded-xl border px-4 py-3 text-sm font-black">{c(language,"IK HEB DIT GECONTROLEERD","I HAVE REVIEWED THIS","J’AI VÉRIFIÉ","ICH HABE DIES GEPRÜFT")}</button>}
    </div>}
   {current.kind==="inspect"&&isOpened&&(chapter==="briefings"||chapter==="tasks")&&<article data-training-full-instructions className="space-y-3 rounded-xl border p-4 text-sm leading-6">
     <h4 className="font-black">{chapter==="briefings"?c(language,"VOLLEDIGE SHIFTBRIEFING","COMPLETE SHIFT BRIEFING","BRIEFING COMPLET DU SERVICE","VOLLSTÄNDIGES SCHICHTBRIEFING"):c(language,"VOLLEDIGE TAAKOMSCHRIJVING","COMPLETE TASK INSTRUCTIONS","INSTRUCTIONS COMPLÈTES","VOLLSTÄNDIGE AUFGABENANWEISUNG")}</h4>
     {(chapter==="briefings"?FULL_INSTRUCTIONS.briefings:FULL_INSTRUCTIONS.tasks).map((row,i)=><p key={i}>{row[language]}</p>)}
   </article>}
   {(current.kind==="write"||current.kind==="number"||current.kind==="delete"||current.kind==="form")&&<div className="grid gap-3">
     <label className="grid gap-1 text-sm font-bold">{current.kind==="number"?c(language,"Aantal of bedrag","Quantity or amount","Quantité ou montant","Anzahl oder Betrag"):current.kind==="delete"?c(language,"Typ DEMO (geen echte verwijdering)","Type DEMO (no real deletion)","Saisissez DEMO (sans suppression réelle)","DEMO eingeben (keine echte Löschung)"):c(language,"Voer een fictieve waarde in","Enter fictional value","Saisissez une valeur fictive","Fiktiven Wert eingeben")}
      <input data-training-active-action={!textValue?"true":undefined} type={current.kind==="number"?"number":"text"} min={current.kind==="number"?1:undefined} value={textValue} onChange={event=>{setTextValue(event.target.value);setDraftFor(current.id);setError("")}} className="w-full rounded-lg border bg-background px-3 py-2 text-foreground" placeholder={current.kind==="number"?"12":current.kind==="delete"?"DEMO":"UpTillDawn Trainingsavond"}/>
     </label>
     {current.kind==="form"&&<label className="grid gap-1 text-sm font-bold">{c(language,"Koppel een categorie of werkplek","Link category or workplace","Associer catégorie ou poste","Kategorie oder Arbeitsplatz zuordnen")}<select data-training-active-action={!selected?"true":undefined} value={selected} onChange={e=>{setSelected(e.target.value);setDraftFor(current.id)}} className="rounded-lg border bg-background p-3"><option value="">{c(language,"Maak een keuze","Choose an option","Choisissez une option","Option wählen")}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label[language]}</option>)}</select></label>}
    </div>}
   {current.kind==="message"&&<label className="grid gap-2 text-sm font-bold">{c(language,"Berichtinhoud (alleen in de demo)","Message content (demo only)","Contenu du message (démo uniquement)","Nachrichteninhalt (nur Demo)")}<textarea data-training-active-action={!textValue?"true":undefined} rows={3} value={textValue} onChange={e=>{setTextValue(e.target.value);setDraftFor(current.id);setError("")}} className="w-full rounded-lg border bg-background p-3" placeholder={c(language,"Voer een concreet trainingsbericht in...","Type a real training example...","Saisissez un exemple de message...","Konkrete Trainingsnachricht eingeben...")}/></label>}
   {current.kind==="select"&&<label className="grid gap-2 text-sm font-bold">{c(language,"Selecteer een optie","Select an option","Sélectionnez une option","Option auswählen")}<select data-training-active-action={!selected?"true":undefined} value={selected} onChange={e=>{setSelected(e.target.value);setDraftFor(current.id);setError("")}} className="w-full rounded-lg border bg-background p-3"><option value="">{c(language,"Maak een keuze","Choose an option","Choisissez une option","Option wählen")}</option>{options.map(option=><option key={option.value} value={option.value}>{option.label[language]}</option>)}</select></label>}
   {current.kind==="toggle"&&<label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold"><input data-training-active-action={!acknowledged?"true":undefined} type="checkbox" checked={acknowledged} onChange={event=>{setAcknowledged(event.target.checked);setDraftFor(current.id);setError("")}} className="size-5 accent-violet-600"/>{current.title[language]}</label>}
   {current.kind==="schedule"&&<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0,1].map((n)=><label key={n} className="grid gap-1 text-sm font-bold">{n===0?c(language,"Begin","Start","Début","Beginn"):c(language,"Einde","End","Fin","Ende")}<input data-training-active-action={!(n===0?firstTime:secondTime)?"true":undefined} type="datetime-local" value={n===0?firstTime:secondTime} onChange={event=>{(n===0?setFirstTime:setSecondTime)(event.target.value);setDraftFor(current.id);setError("")}} className="w-full rounded-lg border bg-background p-3"/></label>)}</div>}
   {current.kind==="upload"&&<div className="grid gap-3"><label className="grid gap-1 text-sm font-bold">{c(language,"Selecteer een demobestand","Select a demo file","Choisir un fichier démo","Demo-Datei auswählen")}<select data-training-active-action={!fileName?"true":undefined} value={fileName} onChange={event=>{setFileName(event.target.value);setDraftFor(current.id);setError("")}} className="rounded-lg border bg-background p-3"><option value="">{c(language,"Kies een voorbeeld","Select an example","Choisir un exemple","Beispiel wählen")}</option><option value="training-briefing.pdf">training-briefing.pdf</option><option value="training-prices.csv">training-prices.csv</option><option value="training-inventory.png">training-inventory.png</option></select></label><label className="grid gap-1 text-xs text-muted-foreground">{c(language,"Of kies een eigen bestand (wordt niet geüpload)","Or select your own file (not uploaded)","Ou sélectionnez un fichier personnel (non téléversé)","Oder eigene Datei wählen (wird nicht hochgeladen)")}<input type="file" onChange={event=>{setFileName(event.target.files?.[0]?.name||"");setDraftFor(current.id)}} className="w-full rounded-lg border bg-background p-2 text-foreground"/></label></div>}
   {current.kind!=="inspect"&&<button type="button" data-training-active-action={!error?"true":undefined} onClick={execute} className="rounded-xl border px-4 py-3 text-sm font-black">{current.kind==="toggle"||current.kind==="message"||current.kind==="upload"||current.kind==="delete"?current.title[language]:c(language,"UITVOEREN IN DE DEMO","PERFORM IN DEMO","EXÉCUTER DANS LA DÉMO","IN DEMO AUSFÜHREN")}</button>}
   {error&&<p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-500">{error}</p>}
  </div>:<div role="status" className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4"><h3 className="font-black text-emerald-600">{c(language,"Alle handelingen in dit hoofdstuk uitgevoerd","All chapter actions completed","Toutes les actions du chapitre sont terminées","Alle Kapitelhandlungen abgeschlossen")}</h3><p className="mt-2 text-sm">{c(language,"Open nu zelf de volgende aangeduide tab. Niets werd automatisch uitgevoerd.","Now open the indicated next tab yourself. No actions were performed automatically.","Ouvrez vous-même l’onglet suivant. Aucune action automatique.","Öffne nun selbst den markierten nächsten Tab. Keine automatischen Aktionen.")}</p></div>}
  <details className="mt-5 rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-bold">{c(language,"Overzicht uitgevoerde handelingen","Completed action log","Journal des actions effectuées","Protokoll ausgeführter Aktionen")}</summary><ol className="mt-3 max-h-60 space-y-2 overflow-y-auto">{operations.filter(step=>ledger[step.id]?.value).map(step=><li key={step.id} className="flex items-start justify-between gap-3 rounded-lg border p-2"><span>{step.title[language]}<small className="mt-1 block break-all text-muted-foreground">{ledger[step.id]?.value}</small></span><span className="text-emerald-600">✓</span></li>)}</ol></details>
  {complete&&<button type="button" onClick={resetAll} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">{c(language,"OEFENINGEN OPNIEUW UITVOEREN","REPEAT EXERCISES","RECOMMENCER LES EXERCICES","ÜBUNGEN WIEDERHOLEN")}</button>}
 </section>
}
