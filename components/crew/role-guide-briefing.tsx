"use client"

import { useEffect, useState } from "react"
import { LANGUAGE_APPLIED_EVENT, activeUiLocale, type SupportedUiLocale } from "@/lib/locale-preferences"

const t=(l:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[l])

const copy={
 admin:{
  title:["Admin · apphandleiding","Admin · app guide","Admin · guide de l’application","Admin · App-Handbuch"],
  intro:["Als Admin beheer je het volledige platform, evenementen en de operationele opvolging.","As Admin you manage the full platform, events and operational follow-up.","En tant qu’Admin, vous gérez toute la plateforme, les événements et le suivi opérationnel.","Als Admin verwaltest du die gesamte Plattform, Events und die operative Nachverfolgung."],
  items:[
   ["Evenementen aanmaken, aanpassen, plannen en archiveren; capaciteit, deadlines en beschikbaarheid opvolgen.","Create, edit, plan and archive events; manage capacity, deadlines and availability.","Créer, modifier, planifier et archiver les événements ; gérer capacité, délais et disponibilités.","Events erstellen, bearbeiten, planen und archivieren; Kapazität, Fristen und Verfügbarkeit verwalten."],
   ["Werkplekken en shifts beheren, personeel en verantwoordelijken toewijzen en planning opvolgen.","Manage workplaces and shifts, assign staff and responsible leads, and follow planning.","Gérer postes et shifts, attribuer personnel et responsables et suivre la planification.","Arbeitsplätze und Schichten verwalten, Personal und Verantwortliche zuweisen und Planung verfolgen."],
   ["Briefings, persoonlijke instructies en operationele checklists maken en bevestigingen opvolgen.","Create briefings, personal instructions and operational checklists and follow acknowledgements.","Créer briefings, instructions personnelles et checklists opérationnelles et suivre les confirmations.","Briefings, persönliche Anweisungen und operative Checklisten erstellen und Bestätigungen verfolgen."],
   ["Check-ins, werkuren, pauzes, overuren, correcties en urenstaten opvolgen en waar toegestaan goedkeuren of overrulen.","Follow check-ins, work hours, breaks, overtime, corrections and timesheets and approve or override where permitted.","Suivre check-ins, heures, pauses, heures supplémentaires, corrections et feuilles d’heures et approuver ou outrepasser si permis.","Check-ins, Arbeitszeiten, Pausen, Überstunden, Korrekturen und Stundenzettel verfolgen und soweit erlaubt genehmigen oder überschreiben."],
   ["Taken, chats, meldingen, incidenten en operationele problemen over alle werkplekken beheren.","Manage tasks, chats, notifications, incidents and operational issues across all workplaces.","Gérer tâches, chats, notifications, incidents et problèmes opérationnels sur tous les postes.","Aufgaben, Chats, Benachrichtigungen, Vorfälle und operative Probleme über alle Arbeitsplätze verwalten."],
   ["Inventaris, prijslijsten, inkom/guestlist, artiestopvolging, backstage en sales beheren.","Manage inventory, price lists, entrance/guest list, artist follow-up, backstage and sales.","Gérer inventaire, listes de prix, entrée/liste invités, suivi artistes, backstage et ventes.","Inventar, Preislisten, Eingang/Gästeliste, Künstlerbetreuung, Backstage und Verkäufe verwalten."],
   ["Personeel, goedkeuringen, rollen, platforminstellingen, exports en toegangsrechten beheren.","Manage personnel, approvals, roles, platform settings, exports and access rights.","Gérer personnel, approbations, rôles, paramètres plateforme, exports et droits d’accès.","Personal, Genehmigungen, Rollen, Plattformeinstellungen, Exporte und Zugriffsrechte verwalten."]
  ]
 },
 responsible_lead:{
  title:["Verantwoordelijke · apphandleiding","Responsible lead · app guide","Responsable · guide de l’application","Verantwortliche Person · App-Handbuch"],
  intro:["Als Verantwoordelijke beheer en volg je uitsluitend je toegewezen werkplek en team binnen je rechten.","As Responsible Lead you manage and follow only your assigned workplace and team within your permissions.","En tant que Responsable, vous gérez et suivez uniquement votre poste et votre équipe attribués selon vos droits.","Als verantwortliche Person verwaltest und betreust du nur deinen zugewiesenen Arbeitsplatz und dein Team innerhalb deiner Rechte."],
  items:[
   ["Bekijk je toegewezen evenementen, werkplek, shifts, briefing en personeel.","View your assigned events, workplace, shifts, briefing and staff.","Consultez vos événements, poste, shifts, briefing et personnel attribués.","Sieh deine zugewiesenen Events, Arbeitsplatz, Schichten, Briefing und Mitarbeiter."],
   ["Bevestig check-ins en volg wie aanwezig, aan het werk, in pauze of klaar is.","Confirm check-ins and follow who is present, working, on break or finished.","Confirmez les check-ins et suivez qui est présent, travaille, est en pause ou a terminé.","Bestätige Check-ins und verfolge, wer anwesend, im Dienst, in Pause oder fertig ist."],
   ["Maak en beheer taken voor je eigen werkplek en wijs ze aan één of meerdere medewerkers toe.","Create and manage tasks for your workplace and assign them to one or more staff members.","Créez et gérez les tâches de votre poste et attribuez-les à un ou plusieurs membres.","Erstelle und verwalte Aufgaben für deinen Arbeitsplatz und weise sie einem oder mehreren Mitarbeitern zu."],
   ["Gebruik inventaris als openings- en afsluitchecklist en registreer ontbrekend of beschadigd materiaal.","Use inventory as opening and closing checklist and record missing or damaged equipment.","Utilisez l’inventaire comme checklist d’ouverture et fermeture et enregistrez le matériel manquant ou endommagé.","Nutze das Inventar als Start- und Abschlusscheckliste und erfasse fehlendes oder beschädigtes Material."],
   ["Volg werk- en pauzetijden en voer alleen correcties uit waarvoor je rechten hebt.","Follow work and break times and make only corrections you are permitted to make.","Suivez temps de travail et pauses et effectuez uniquement les corrections autorisées.","Verfolge Arbeits- und Pausenzeiten und führe nur erlaubte Korrekturen aus."],
   ["Behandel hulpvragen en incidenten van je werkplek en escaleer naar Admin wanneer nodig.","Handle help requests and incidents for your workplace and escalate to Admin when needed.","Traitez demandes d’aide et incidents de votre poste et transmettez à l’Admin si nécessaire.","Bearbeite Hilfeanfragen und Vorfälle deines Arbeitsplatzes und eskaliere bei Bedarf an Admin."],
   ["Gebruik werkplekchat, volg urenstaten binnen je rechten en voer bij afsluiting de eindcontrole uit.","Use workplace chat, follow timesheets within your permissions and perform the final workplace check at closing.","Utilisez le chat du poste, suivez les feuilles d’heures selon vos droits et effectuez le contrôle final à la fermeture.","Nutze den Arbeitsplatz-Chat, verfolge Stundenzettel innerhalb deiner Rechte und führe beim Abschluss die Endkontrolle durch."]
  ]
 },
 employee:{
  title:["Personeel · apphandleiding","Staff · app guide","Personnel · guide de l’application","Personal · App-Handbuch"],
  intro:["Als personeelslid gebruik je de app voor je beschikbaarheid, toegewezen werk en volledige shiftworkflow.","As staff you use the app for availability, assigned work and your complete shift workflow.","En tant que membre du personnel, vous utilisez l’application pour vos disponibilités, votre travail attribué et tout le workflow du shift.","Als Mitarbeiter nutzt du die App für Verfügbarkeit, zugewiesene Arbeit und deinen vollständigen Schichtablauf."],
  items:[
   ["Geef vóór de deadline aan of je beschikbaar bent voor Event, Opbouw en Afbouw.","Before the deadline, indicate whether you are available for Event, Setup and Breakdown.","Avant la date limite, indiquez votre disponibilité pour Événement, Montage et Démontage.","Gib vor der Frist deine Verfügbarkeit für Event, Aufbau und Abbau an."],
   ["Bekijk na toewijzing je werkplek en shift en lees en bevestig de evenementbriefing.","After assignment, view your workplace and shift and read and confirm the event briefing.","Après attribution, consultez votre poste et shift puis lisez et confirmez le briefing événement.","Sieh nach der Zuweisung Arbeitsplatz und Schicht und lies und bestätige das Event-Briefing."],
   ["Meld je bij de verantwoordelijke, voer check-in uit en start je werkuren pas wanneer je shift begint.","Report to the responsible lead, check in and start work hours only when your shift begins.","Présentez-vous au responsable, effectuez le check-in et démarrez vos heures uniquement au début du shift.","Melde dich bei der verantwortlichen Person, checke ein und starte die Arbeitszeit erst bei Schichtbeginn."],
   ["Bekijk en voltooi je toegewezen taken en volg de instructies van je verantwoordelijke.","View and complete assigned tasks and follow your responsible lead’s instructions.","Consultez et terminez vos tâches attribuées et suivez les instructions de votre responsable.","Sieh und erledige deine zugewiesenen Aufgaben und befolge die Anweisungen deiner verantwortlichen Person."],
   ["Start en stop je verplichte pauze via Mijn werkuren en hervat daarna je werk.","Start and stop your mandatory break through My work hours and resume work afterwards.","Démarrez et arrêtez votre pause obligatoire via Mes heures de travail puis reprenez le travail.","Starte und beende deine Pflichtpause über Meine Arbeitszeiten und setze danach die Arbeit fort."],
   ["Gebruik Help/Incidenten bij problemen en gebruik chat voor de beschikbare operationele communicatie.","Use Help/Incidents for problems and chat for available operational communication.","Utilisez Aide/Incidents en cas de problème et le chat pour la communication opérationnelle disponible.","Nutze Hilfe/Vorfälle bei Problemen und den Chat für verfügbare operative Kommunikation."],
   ["Stop je werkuren aan het einde, controleer je geregistreerde uren en dien je urenstaat in.","Stop work hours at the end, verify recorded hours and submit your timesheet.","Arrêtez vos heures à la fin, vérifiez les heures enregistrées et soumettez votre feuille d’heures.","Beende am Schluss die Arbeitszeit, prüfe die erfassten Stunden und reiche deinen Stundenzettel ein."]
  ]
 }
} as const

export function RoleGuideBriefing({role}:{role:string}){
 const [l,setL]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
 const [open,setOpen]=useState(false)
 useEffect(()=>{const apply=()=>setL(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const key=role==="admin"?"admin":role==="responsible_lead"?"responsible_lead":"employee"
 const c=copy[key]
 return <article className="rounded-xl border border-violet-500/50 p-4">
  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t(l,"Altijd beschikbaar · niet evenementgebonden","Always available · not event-specific","Toujours disponible · non lié à un événement","Immer verfügbar · nicht eventgebunden")}</p>
  <h2 className="mt-1 text-xl font-bold">{c.title[{nl:0,en:1,fr:2,de:3}[l]]}</h2>
  <p className="mt-2 text-sm text-muted-foreground">{c.intro[{nl:0,en:1,fr:2,de:3}[l]]}</p>
  <button type="button" onClick={()=>setOpen(v=>!v)} className="mt-4 rounded-xl border px-4 py-3 font-bold">{open?t(l,"HANDLEIDING SLUITEN","CLOSE GUIDE","FERMER LE GUIDE","HANDBUCH SCHLIESSEN"):t(l,"HANDLEIDING OPENEN","OPEN GUIDE","OUVRIR LE GUIDE","HANDBUCH ÖFFNEN")}</button>
  {open&&<ul className="mt-4 list-disc space-y-2 pl-5 text-sm">{c.items.map((item,i)=><li key={i}>{item[{nl:0,en:1,fr:2,de:3}[l]]}</li>)}</ul>}
 </article>
}
