import type {TourRole,TourCopy} from "./tour-training"
import type {PracticeLedger,PracticeOperation} from "./training-exercise-catalog"

// The lesson uses one isolated event ledger, never a network write. Every status
// is derived from a trainee action; a visit, timer or illustrative demo button
// cannot impersonate a completed operation.
const c=(nl:string,en:string,fr:string,de:string):TourCopy=>({nl,en,fr,de})
const has=(ledger:PracticeLedger,id:string)=>Boolean(ledger[id]?.value&&ledger[id]?.at)
const value=(ledger:PracticeLedger,id:string)=>ledger[id]?.value||""
export type TrainingDomain="approval"|"event"|"workplace"|"briefing"|"attendance"|"break"|"driver"|"task"|"inventory"|"guestlist"|"chat"|"timesheet"
export type TrainingDomainStatus={domain:TrainingDomain;title:TourCopy;status:"pending"|"active"|"completed";detail:TourCopy}

export function trainingOperationalState(role:TourRole,ledger:PracticeLedger):TrainingDomainStatus[]{
  const admin=role==="admin",lead=role==="responsible_lead",staff=role==="employee"
  const r=lead?"responsible_lead":"employee"
  const get=(...ids:string[])=>ids.some(id=>has(ledger,id))
  const make=(domain:TrainingDomain,title:TourCopy,done:boolean,active:boolean,detail:TourCopy):TrainingDomainStatus=>({
    domain,title,status:done?"completed":active?"active":"pending",detail
  })
  const eventName=value(ledger,"events:admin:0").split(" · ")[0]||"UpTillDawn Trainingsavond"
  const workplace=value(ledger,"workplaces:admin:0").split(" · ")[0]||"Main Bar"
  const approval=get("personnel:admin:3")
  const event=get("events:admin:6")
  const shift=get("workplaces:admin:3")&&get("workplaces:admin:4")
  const briefing=get("briefings:shared:5")&&(admin||get("briefings:"+r+":"+(lead?2:1)))
  const checked=get("operations:employee:0","operations:responsible_lead:0","driver:shared:4")
  const working=get("operations:employee:2","operations:responsible_lead:1","driver:shared:5")
  const breakStarted=get("operations:employee:3","operations:responsible_lead:2")
  const breakEnded=get("operations:employee:5","operations:responsible_lead:3")
  const startedDrive=get("driver:shared:6")
  const stoppedDrive=get("driver:shared:9")
  const task=get("tasks:shared:4")
  const inventory=get("inventory:shared:3","inventory:responsible_lead:3")
  const artist=get("guestlist:shared:4","guestlist:employee:1")
  const chat=get("chat:shared:6","chat:admin:2")
  const stopWork=get("timesheet:"+r+":0")
  const submitted=get("timesheet:"+r+":3")
  const adminTimesheet=get("timesheet:admin:5")
  const rows=[
    make("approval",c("Registratie en goedkeuring","Registration and approval","Inscription et approbation","Registrierung und Genehmigung"),approval,get("personnel:admin:0"),c(approval?"Demo-account goedgekeurd.":"Wachten op admin-goedkeuring.",approval?"Demo account approved.":"Awaiting admin approval.",approval?"Compte démo approuvé.":"En attente d’approbation.",approval?"Demokonto genehmigt.":"Warten auf Freigabe.")),
    make("event",c("Evenement","Event","Événement","Event"),event,get("events:admin:0","events:shared:3"),c(eventName,eventName,eventName,eventName)),
    make("workplace",c("Werkplek en shift","Workplace and shift","Poste et service","Arbeitsplatz und Schicht"),shift,get("workplaces:admin:0","workplaces:shared:0"),c(workplace,workplace,workplace,workplace)),
    make("briefing",c("Briefing gelezen","Briefing reviewed","Briefing lu","Briefing gelesen"),briefing,get("briefings:shared:0"),c(briefing?"Gelezen en bevestigd.":"Eerst openen, lezen en bevestigen.",briefing?"Opened, read and acknowledged.":"Open, read and acknowledge first.",briefing?"Ouvert, lu et confirmé.":"Ouvrir, lire et confirmer.",briefing?"Geöffnet, gelesen und bestätigt.":"Zuerst öffnen, lesen und bestätigen.")),
    make("attendance",c("Aanwijzing en werktimer","Check-in and work clock","Pointage et chrono de travail","Check-in und Arbeitszeit"),working,checked,c(working?"Werkklok actief.":checked?"Aanwijzing bevestigd.":"Aanwijzing nog te doen.",working?"Work clock active.":checked?"Check-in confirmed.":"Check-in not done.",working?"Chrono actif.":checked?"Pointage confirmé.":"Pointage à effectuer.",working?"Arbeitszeit läuft.":checked?"Check-in bestätigt.":"Check-in ausstehend.")),
    make("break",c("Pauze","Break","Pause","Pause"),breakEnded,breakStarted,c(breakEnded?"Pauze beëindigd, werkuren hervat.":breakStarted?"Pauzeklok loopt.":"Pauze nog niet gestart.",breakEnded?"Break ended, work clock resumed.":breakStarted?"Break timer running.":"Break not started.",breakEnded?"Pause terminée, travail repris.":breakStarted?"Pause en cours.":"Pause non commencée.",breakEnded?"Pause beendet, Arbeitszeit fortgesetzt.":breakStarted?"Pausentimer läuft.":"Pause nicht begonnen.")),
    make("driver",c("Driver-rit","Driver trip","Trajet chauffeur","Fahrt"),stoppedDrive,startedDrive,c(stoppedDrive?"Rit gestopt, eventuren hervat.":startedDrive?"Eventuren gepauzeerd tijdens rit.":"Geen rit gestart.",stoppedDrive?"Trip ended, event clock resumed.":startedDrive?"Event clock paused during driving.":"No trip started.",stoppedDrive?"Trajet terminé, temps d’événement repris.":startedDrive?"Temps d’événement suspendu pendant le trajet.":"Aucun trajet commencé.",stoppedDrive?"Fahrt beendet, Eventzeit fortgesetzt.":startedDrive?"Eventzeit während Fahrt pausiert.":"Keine Fahrt begonnen.")),
    make("task",c("Taken","Tasks","Tâches","Aufgaben"),task,get("tasks:shared:0"),c(task?"Demo-taak uitgevoerd.":"Taak nog niet uitgevoerd.",task?"Demo task action performed.":"Task not completed.",task?"Action de tâche effectuée.":"Tâche non effectuée.",task?"Demo-Aufgabe ausgeführt.":"Aufgabe noch offen.")),
    make("inventory",c("Inventariscontrole","Inventory inspection","Contrôle d’inventaire","Inventarkontrolle"),inventory,get("inventory:shared:0"),c(inventory?"Opstartcontrole geregistreerd.":"Materiaal nog niet gecontroleerd.",inventory?"Opening inspection recorded.":"Equipment not yet inspected.",inventory?"Contrôle d’ouverture enregistré.":"Matériel à vérifier.",inventory?"Startkontrolle erfasst.":"Material noch zu prüfen.")),
    make("guestlist",c("Inkom en Backstage","Entrance and Backstage","Entrée et coulisses","Eingang und Backstage"),artist,get("guestlist:shared:0"),c(artist?"Artiestaankomst gesimuleerd.":"Artiest nog verwacht.",artist?"Artist arrival simulated.":"Artist still expected.",artist?"Arrivée artiste simulée.":"Artiste encore attendu.",artist?"Künstlerankunft simuliert.":"Künstler noch erwartet.")),
    make("chat",c("Communicatie","Communication","Communication","Kommunikation"),chat,get("chat:shared:0"),c(chat?"Demobericht vastgelegd.":"Geen demobericht verstuurd.",chat?"Demo message recorded.":"No demo message sent.",chat?"Message démo enregistré.":"Aucun message envoyé.",chat?"Demonachricht erfasst.":"Keine Nachricht gesendet.")),
    make("timesheet",c("Urenstaat","Timesheet","Feuille d’heures","Stundenzettel"),admin?adminTimesheet:submitted,get("timesheet:shared:0")||(staff||lead)&&stopWork,c(admin?adminTimesheet?"Demo-urenstaat vergrendeld.":"Wacht op beoordeling.":submitted?"Werk beëindigd en urenstaat ingediend.":stopWork?"Werk gestopt; urenstaat nog indienen.":"Werkuren lopen nog.",admin?adminTimesheet?"Demo timesheet locked.":"Awaiting review.":submitted?"Work stopped, timesheet submitted.":stopWork?"Work stopped; submit timesheet.":"Work still active.",admin?adminTimesheet?"Feuille démo verrouillée.":"En attente de révision.":submitted?"Travail arrêté, feuille soumise.":stopWork?"Travail arrêté ; soumettre les heures.":"Travail encore actif.",admin?adminTimesheet?"Demostundenzettel gesperrt.":"Wartet auf Prüfung.":submitted?"Arbeit beendet, Stundenzettel eingereicht.":stopWork?"Arbeit beendet; Stundenzettel einreichen.":"Arbeitszeit läuft noch."))
  ]
  return rows.filter(row=>{
    if(admin)return !["attendance","break","driver"].includes(row.domain)
    if(staff)return row.domain!=="approval"
    return row.domain!=="approval"
  })
}

// Explicit guards prevent a checkbox from replacing a missing prerequisite.
// The step list is still authoritative for exact role/chapter progression.
export function trainingOperationError(role:TourRole,step:PracticeOperation,ledger:PracticeLedger):TourCopy|null{
  if(step.id==="briefings:shared:5"&&!["briefings:shared:0","briefings:shared:1","briefings:shared:2","briefings:shared:3","briefings:shared:4"].every(id=>has(ledger,id)))
    return c("Open en lees alle onderdelen van de briefing vóór bevestiging.","Open and read every briefing section before acknowledging.","Ouvrez et lisez toutes les sections avant confirmation.","Alle Briefingabschnitte vor der Bestätigung öffnen und lesen.")
  if(step.id==="operations:employee:2"&&!has(ledger,"operations:employee:0"))
    return c("Vraag eerst aanwijzing bij de verantwoordelijke.","Request lead check-in before starting work.","Demandez d’abord le pointage du responsable.","Zuerst beim Verantwortlichen einchecken.")
  if(step.id==="operations:employee:3"&&!has(ledger,"operations:employee:2"))
    return c("Start eerst je werktimer.","Start work before taking a break.","Démarrez le travail avant la pause.","Vor der Pause Arbeit starten.")
  if(step.id==="operations:employee:5"&&!has(ledger,"operations:employee:3"))
    return c("Start eerst een pauze.","Start a break before ending it.","Commencez la pause avant de la terminer.","Vor dem Beenden eine Pause starten.")
  if(step.id==="driver:shared:6"&&!has(ledger,"driver:shared:5"))
    return c("Start eerst de eventuren.","Start event work time before driving.","Démarrez les heures d’événement avant de conduire.","Vor Fahrtantritt Event-Arbeitszeit starten.")
  if(step.id==="driver:shared:9"&&!has(ledger,"driver:shared:6"))
    return c("Start eerst de rit.","Start Driving before stopping the trip.","Commencez la conduite avant de l’arrêter.","Vor dem Beenden die Fahrt starten.")
  if((step.id==="timesheet:employee:3"||step.id==="timesheet:responsible_lead:3")&&!has(ledger,"timesheet:"+role+":0"))
    return c("Stop eerst de fictieve werkuren.","Stop fictional work hours first.","Arrêtez d’abord les heures fictives.","Zuerst die fiktive Arbeitszeit beenden.")
  return null
}
