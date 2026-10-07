export type TourRole="employee"|"responsible_lead"|"admin"
export type TourLocale="nl"|"en"|"fr"|"de"
export type TourMode="full"|"new"
export type TourScenario="pre_event"|"live_event"|"break"|"post_event"|"general"
export type TourCopy=Record<TourLocale,string>
export type TourRequirement="driver"|"entrance"

export type TourChapter={
  key:string
  route:string
  roles:readonly TourRole[]
  scenario:TourScenario
  title:TourCopy
  description:TourCopy
  mobileSelector:string
  desktopSelector:string
  fallbackSelector:string
  requires?:TourRequirement
  newSince?:number
}

export const TOUR_VERSION=8
export const TOUR_SESSION_KEY="uptilldawn-tour-active-v8"
export const TOUR_WORKFLOW_KEY="uptilldawn-training-workflow-v3"

const c=(nl:string,en:string,fr:string,de:string):TourCopy=>({nl,en,fr,de})
const all=["employee","responsible_lead","admin"] as const
const crew=["employee","responsible_lead"] as const

export const TOUR_CHAPTERS:readonly TourChapter[]=[
  {key:"overview",route:"/",roles:all,scenario:"general",title:c("Overzicht","Overview","Aperçu","Übersicht"),description:c("Leer het actieve evenement, je rol en de directe vervolgstappen lezen.","Learn to read the live event, your role and the next actions.","Apprenez à lire l’événement actif, votre rôle et les prochaines actions.","Lerne, das aktive Event, deine Rolle und die nächsten Schritte zu lesen."),mobileSelector:'[data-tour-demo="training-screen"]',desktopSelector:'[data-tour-demo="training-screen"]',fallbackSelector:"main"},
  {key:"events",route:"/events",roles:all,scenario:"pre_event",title:c("Evenement & beschikbaarheid","Event & availability","Événement & disponibilité","Event & Verfügbarkeit"),description:c("Open het demo-event en doorloop beschikbaarheid zonder echte eventgegevens te wijzigen.","Open the demo event and complete availability without changing real event data.","Ouvrez l’événement démo et complétez la disponibilité sans modifier les données réelles.","Öffne das Demo-Event und bestätige die Verfügbarkeit, ohne echte Eventdaten zu ändern."),mobileSelector:"main details",desktopSelector:"main details",fallbackSelector:"main"},
  {key:"workplaces",route:"/workplaces",roles:all,scenario:"pre_event",title:c("Werkplek & shift","Workplace & shift","Poste & shift","Arbeitsplatz & Schicht"),description:c("Bekijk je fictieve werkplek, shift, verantwoordelijke en ploeg.","Review your fictional workplace, shift, responsible lead and crew.","Consultez votre poste fictif, votre shift, le responsable et l’équipe.","Sieh dir deinen fiktiven Arbeitsplatz, die Schicht, die verantwortliche Person und das Team an."),mobileSelector:"main article",desktopSelector:"main article",fallbackSelector:"main",newSince:8},
  {key:"briefings",route:"/briefings",roles:all,scenario:"pre_event",title:c("Briefing","Briefing","Briefing","Briefing"),description:c("Open, lees en bevestig een volledige shiftbriefing en checklist.","Open, read and confirm a complete shift briefing and checklist.","Ouvrez, lisez et confirmez un briefing de shift complet et sa checklist.","Öffne, lies und bestätige ein vollständiges Schichtbriefing samt Checkliste."),mobileSelector:"main article",desktopSelector:"main article",fallbackSelector:"main",newSince:8},
  {key:"operations",route:"/operations",roles:all,scenario:"live_event",title:c("Werkuren tijdens het event","Work hours during the event","Heures pendant l’événement","Arbeitszeiten während des Events"),description:c("Doorloop check-in, werkstart, pauze, werkstop en urenstaat in de sandbox.","Complete check-in, work start, break, work stop and timesheet in the sandbox.","Effectuez le check-in, le début du travail, la pause, la fin du travail et la feuille d’heures dans le sandbox.","Durchlaufe Check-in, Arbeitsstart, Pause, Arbeitsende und Stundenzettel in der Sandbox."),mobileSelector:'[data-tour-demo="time-actions"]',desktopSelector:'[data-tour-demo="time-actions"]',fallbackSelector:"main"},
  {key:"driver",route:"/operations",roles:crew,scenario:"live_event",title:c("Driver-workflow","Driver workflow","Workflow Driver","Driver-Workflow"),description:c("Simuleer eventtijd → Start Driving → artiest ophalen → terugrit → Stop Driving, inclusief kilometers en Backstage-ETA.","Simulate event time → Start Driving → artist pickup → return trip → Stop Driving, including mileage and Backstage ETA.","Simulez temps événement → Start Driving → prise en charge artiste → retour → Stop Driving, avec kilomètres et ETA Backstage.","Simuliere Eventzeit → Start Driving → Künstler abholen → Rückfahrt → Stop Driving, inklusive Kilometer und Backstage-ETA."),mobileSelector:'[data-tour-demo="time-actions"]',desktopSelector:'[data-tour-demo="time-actions"]',fallbackSelector:"main",requires:"driver",newSince:8},
  {key:"tasks",route:"/tasks",roles:all,scenario:"live_event",title:c("Taken","Tasks","Tâches","Aufgaben"),description:c("Voer een toegewezen demotaak uit en volg de operationele vervolgstap.","Complete an assigned demo task and follow the operational next step.","Effectuez une tâche démo attribuée et suivez l’étape opérationnelle suivante.","Erledige eine zugewiesene Demo-Aufgabe und folge dem nächsten operativen Schritt."),mobileSelector:"main article",desktopSelector:"main article",fallbackSelector:"main"},
  {key:"incidents",route:"/incidents",roles:all,scenario:"live_event",title:c("Help & incidenten","Help & incidents","Aide & incidents","Hilfe & Vorfälle"),description:c("Simuleer een hulp- of incidentmelding zonder een echte melding te versturen.","Simulate a help or incident report without sending a real report.","Simulez une demande d’aide ou un incident sans envoyer de vrai signalement.","Simuliere eine Hilfe- oder Vorfallmeldung, ohne eine echte Meldung zu senden."),mobileSelector:"main section",desktopSelector:"main section",fallbackSelector:"main"},
  {key:"inventory",route:"/inventory",roles:all,scenario:"live_event",title:c("Inventaris","Inventory","Inventaire","Inventar"),description:c("Controleer fictief materiaal en voer de opstartcheck uit.","Check fictional equipment and complete the opening check.","Contrôlez le matériel fictif et effectuez le contrôle d’ouverture.","Prüfe fiktives Material und führe den Startcheck durch."),mobileSelector:"main article",desktopSelector:"main article",fallbackSelector:"main"},
  {key:"guestlist",route:"/guestlist",roles:all,scenario:"live_event",title:c("Inkom & Guestlist","Entrance & Guestlist","Entrée & Guestlist","Eingang & Gästeliste"),description:c("Registreer een fictieve artiestenaankomst en bekijk de Backstage-melding.","Register a fictional artist arrival and review the Backstage notification.","Enregistrez l’arrivée fictive d’un artiste et consultez la notification Backstage.","Registriere eine fiktive Künstlerankunft und prüfe die Backstage-Benachrichtigung."),mobileSelector:"main article",desktopSelector:"main article",fallbackSelector:"main",requires:"entrance"},
  {key:"sales",route:"/sales",roles:["admin"],scenario:"live_event",title:c("Sales","Sales","Ventes","Verkauf"),description:c("Controleer fictieve omzet van merch en kassa/tokens.","Review fictional merchandise and till/token revenue.","Contrôlez les revenus fictifs du merch et de la caisse/jetons.","Prüfe fiktive Einnahmen aus Merch und Kasse/Tokens."),mobileSelector:"main section",desktopSelector:"main section",fallbackSelector:"main"},
  {key:"personnel",route:"/personnel",roles:["admin"],scenario:"general",title:c("Goedkeuringen","Approvals","Approbations","Genehmigungen"),description:c("Doorloop een fictieve accountgoedkeuring en initiële roltoewijzing.","Complete a fictional account approval and initial role assignment.","Effectuez une approbation de compte fictive et l’attribution du rôle initial.","Durchlaufe eine fiktive Kontogenehmigung und anfängliche Rollenzuweisung."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
  {key:"crew",route:"/crew",roles:all,scenario:"general",title:c("Personeel","Staff","Personnel","Personal"),description:c("Bekijk hoe personeelsinformatie en rolgebonden toegang worden gebruikt.","See how staff information and role-scoped access are used.","Découvrez comment les informations du personnel et les accès par rôle sont utilisés.","Sieh, wie Personalinformationen und rollenbezogene Zugriffe verwendet werden."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
  {key:"chat",route:"/chat",roles:all,scenario:"live_event",title:c("Chats","Chats","Chats","Chats"),description:c("Stuur een fictief trainingsbericht in de eventchat.","Send a fictional training message in the event chat.","Envoyez un message de formation fictif dans le chat de l’événement.","Sende eine fiktive Trainingsnachricht im Event-Chat."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
  {key:"exports",route:"/exports",roles:["admin"],scenario:"post_event",title:c("Excel & urenexport","Excel & time export","Excel & export des heures","Excel & Stundenexport"),description:c("Bereid een fictieve export van goedgekeurde en gelockte uren voor.","Prepare a fictional export of approved and locked hours.","Préparez un export fictif des heures approuvées et verrouillées.","Bereite einen fiktiven Export genehmigter und gesperrter Stunden vor."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
  {key:"platform",route:"/admin/platform",roles:["admin"],scenario:"general",title:c("Platformbeheer","Platform management","Gestion de la plateforme","Plattformverwaltung"),description:c("Bekijk automatiseringen, recovery en technische configuratie in veilige demo-modus.","Review automations, recovery and technical configuration in safe demo mode.","Consultez les automatisations, le recovery et la configuration technique en mode démo sûr.","Prüfe Automatisierungen, Recovery und technische Konfiguration im sicheren Demo-Modus."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
  {key:"settings",route:"/settings",roles:all,scenario:"post_event",title:c("Afronden & instellingen","Finish & settings","Terminer & paramètres","Abschluss & Einstellungen"),description:c("Controleer profiel en taal en rond de roltraining af.","Review profile and language and finish the role training.","Vérifiez le profil et la langue puis terminez la formation du rôle.","Prüfe Profil und Sprache und schließe das Rollentraining ab."),mobileSelector:'[data-tour-demo="primary-action"]',desktopSelector:'[data-tour-demo="primary-action"]',fallbackSelector:"main"},
] as const

export function tourText(copy:TourCopy,locale:TourLocale){return copy[locale]}

export function tourWorkplaceKey(workplace?:string){
  const normalized=(workplace||"general").trim().toLocaleLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")
  return normalized||"general"
}

export function tourProgressKey(userId:string,role:TourRole,workplace?:string){
  return "uptilldawn-tour-progress:"+userId+":"+role+":"+tourWorkplaceKey(workplace)+":v"+TOUR_VERSION
}

export function tourRoute(role:TourRole,chapter:TourChapter){
  const base=chapter.key==="overview"&&role==="admin"?"/admin":chapter.route
  return base+(base.includes("?")?"&":"?")+"tour=1"
}

export function tourBaseRoute(role:TourRole,chapter:TourChapter){
  return chapter.key==="overview"&&role==="admin"?"/admin":chapter.route
}

export function getTourChapters(role:TourRole,options?:{driver?:boolean;entrance?:boolean;mode?:TourMode;scope?:"general"|"workplace"}){
  const driver=options?.driver===true
  const entrance=options?.entrance===true
  return TOUR_CHAPTERS.filter(chapter=>{
    if(!chapter.roles.includes(role))return false
    if(chapter.requires==="driver"&&!driver)return false
    if(chapter.requires==="entrance"&&role!=="admin"&&!entrance)return false
    if(options?.mode==="new"&&chapter.newSince!==TOUR_VERSION)return false
    return true
  })
}

export function chapterForPath(role:TourRole,pathname:string,chapters:readonly TourChapter[]){
  return chapters.find(chapter=>tourBaseRoute(role,chapter)===pathname)
}
