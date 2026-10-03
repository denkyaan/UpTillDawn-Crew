"use client"
import {useEffect,useMemo,useState} from "react"
import {useAuth,type UiRole} from "@/lib/providers"
import {createClient} from "@/lib/supabase/crew-client"
import {translateRuntimeUi} from "@/lib/ui-translation-runtime"
import {initialUiLocale,parseUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"
import type {ExtendedUiLocale} from "@/lib/ui-translation-extensions"

type TourText={nl:string;en:string;fr:string;de:string}
const TOUR_TRANSLATIONS:Record<string,Omit<TourText,"nl">>={
 "Beschikbaarheid":{en:"Availability",fr:"Disponibilité",de:"Verfügbarkeit"},
 "Hier geef je IK KAN of IK KAN NIET door en ook opbouw- en afbouwbeschikbaarheid.":{en:"Here you indicate I CAN or I CANNOT and also your setup and teardown availability.",fr:"Indiquez ici JE PEUX ou JE NE PEUX PAS ainsi que votre disponibilité pour le montage et le démontage.",de:"Hier gibst du ICH KANN oder ICH KANN NICHT sowie deine Verfügbarkeit für Auf- und Abbau an."},
 "Reden wijzigen":{en:"Reason for change",fr:"Raison du changement",de:"Änderungsgrund"},
 "Als je beschikbaarheid verandert, geef je hier de reden door.":{en:"If your availability changes, enter the reason here.",fr:"Si votre disponibilité change, indiquez-en la raison ici.",de:"Wenn sich deine Verfügbarkeit ändert, gib hier den Grund an."},
 "Werkplekinformatie":{en:"Workplace information",fr:"Informations sur le poste",de:"Arbeitsplatzinformationen"},
 "Hier vind je omschrijving, bezetting en operationele informatie van je werkplek.":{en:"Here you find the description, staffing and operational information for your workplace.",fr:"Vous trouverez ici la description, l’effectif et les informations opérationnelles de votre poste.",de:"Hier findest du Beschreibung, Besetzung und operative Informationen zu deinem Arbeitsplatz."},
 "Shiftinformatie":{en:"Shift information",fr:"Informations sur le shift",de:"Schichtinformationen"},
 "Je uren en werkplekcontext worden hier aan het evenement gekoppeld.":{en:"Your hours and workplace context are linked to the event here.",fr:"Vos heures et le contexte de votre poste sont liés ici à l’événement.",de:"Deine Zeiten und dein Arbeitsplatzkontext werden hier mit der Veranstaltung verknüpft."},
 "Werkstatus":{en:"Work status",fr:"Statut de travail",de:"Arbeitsstatus"},
 "Hier zie je je actieve werk- en pauzetimer en beschikbare tijdsacties.":{en:"Here you see your active work and break timer and available time actions.",fr:"Vous voyez ici vos chronomètres de travail et de pause actifs ainsi que les actions disponibles.",de:"Hier siehst du deine aktive Arbeits- und Pausenuhr sowie verfügbare Zeitaktionen."},
 "Check-in en werkuren":{en:"Check-in and work hours",fr:"Check-in et heures de travail",de:"Check-in und Arbeitszeiten"},
 "Hier start en stop je werk en pauze. De rondleiding voert zelf geen tijdsactie uit.":{en:"Start and stop work and breaks here. The tour never performs a time action itself.",fr:"Démarrez et arrêtez ici le travail et les pauses. La visite n’exécute elle-même aucune action horaire.",de:"Hier startest und stoppst du Arbeit und Pausen. Die Führung führt selbst keine Zeitaktion aus."},
 "Briefing lezen":{en:"Read briefing",fr:"Lire le briefing",de:"Briefing lesen"},
 "Lees event- en werkplekinstructies volledig voordat je bevestigt.":{en:"Read all event and workplace instructions before confirming.",fr:"Lisez entièrement les instructions de l’événement et du poste avant de confirmer.",de:"Lies alle Veranstaltungs- und Arbeitsplatzanweisungen vollständig, bevor du bestätigst."},
 "Bevestigen":{en:"Confirm",fr:"Confirmer",de:"Bestätigen"},
 "Met de bevestigingsactie registreer je dat je de instructie hebt gelezen.":{en:"Confirming records that you have read the instruction.",fr:"La confirmation enregistre que vous avez lu l’instruction.",de:"Mit der Bestätigung wird gespeichert, dass du die Anweisung gelesen hast."},
 "Toegewezen taken":{en:"Assigned tasks",fr:"Tâches attribuées",de:"Zugewiesene Aufgaben"},
 "Hier staan je operationele taken, omschrijving, deadline en status.":{en:"Your operational tasks, description, deadline and status are shown here.",fr:"Vos tâches opérationnelles, leur description, échéance et statut sont affichés ici.",de:"Hier stehen deine operativen Aufgaben, Beschreibung, Frist und Status."},
 "Taakstatus":{en:"Task status",fr:"Statut de la tâche",de:"Aufgabenstatus"},
 "Werk de taakstatus bij wanneer je begint of afrondt.":{en:"Update the task status when you start or finish it.",fr:"Mettez à jour le statut de la tâche lorsque vous la commencez ou la terminez.",de:"Aktualisiere den Aufgabenstatus, wenn du beginnst oder fertig bist."},
 "Materiaaloverzicht":{en:"Equipment overview",fr:"Aperçu du matériel",de:"Materialübersicht"},
 "Bekijk per werkplek welk materiaal aanwezig hoort te zijn.":{en:"See which equipment should be present at each workplace.",fr:"Consultez le matériel qui doit être présent à chaque poste.",de:"Sieh pro Arbeitsplatz, welches Material vorhanden sein sollte."},
 "Status materiaal":{en:"Equipment status",fr:"Statut du matériel",de:"Materialstatus"},
 "Wanneer jouw rol dit toestaat, meld je hier ontbrekend of defect materiaal.":{en:"When your role allows it, report missing or defective equipment here.",fr:"Lorsque votre rôle le permet, signalez ici le matériel manquant ou défectueux.",de:"Wenn deine Rolle es erlaubt, meldest du hier fehlendes oder defektes Material."},
 "Event kiezen":{en:"Choose event",fr:"Choisir l’événement",de:"Veranstaltung auswählen"},
 "Selecteer het juiste evenement voordat je gasten of artiesten verwerkt.":{en:"Select the correct event before processing guests or artists.",fr:"Sélectionnez le bon événement avant de traiter les invités ou artistes.",de:"Wähle die richtige Veranstaltung, bevor du Gäste oder Künstler bearbeitest."},
 "Guestlist":{en:"Guest list",fr:"Liste des invités",de:"Gästeliste"},
 "Hier zoek en controleer je gasten, artiesten, spots en notities.":{en:"Search and check guests, artists, spots and notes here.",fr:"Recherchez et vérifiez ici les invités, artistes, places et notes.",de:"Hier suchst und prüfst du Gäste, Künstler, Plätze und Notizen."},
 "Chatkanalen":{en:"Chat channels",fr:"Canaux de discussion",de:"Chatkanäle"},
 "Kies het juiste organisatie-, event- of werkplekkanaal.":{en:"Choose the correct organisation, event or workplace channel.",fr:"Choisissez le bon canal d’organisation, d’événement ou de poste.",de:"Wähle den richtigen Organisations-, Veranstaltungs- oder Arbeitsplatzkanal."},
 "Berichten":{en:"Messages",fr:"Messages",de:"Nachrichten"},
 "Gebruik chat voor operationele communicatie met je crew.":{en:"Use chat for operational communication with your crew.",fr:"Utilisez le chat pour la communication opérationnelle avec votre équipe.",de:"Nutze den Chat für die operative Kommunikation mit deiner Crew."},
}

const VERSION=3
type Step={title:string;body:string;selector:string;route?:string;inside?:Array<{title:string;body:string;selector:string}>}
const tours:Record<UiRole,Step[]>={
 employee:[
  {title:"Welkom bij Up Till Dawn Crew",body:"We lopen interactief door alle functies die bij Personeel horen. Tijdens de rondleiding zie je ook functies die normaal pas verschijnen bij een toegewezen evenement of actieve shift.",selector:"header"},
  {title:"Overzicht",body:"Je startpagina bundelt je huidige event-, shift- en werkstatus.",selector:'[data-layout-key="overview"]'},
  {title:"Evenementen",body:"Bekijk evenementen en geef vóór de deadline aan of je beschikbaar bent.",selector:'[data-layout-key="events"]',route:"/events",inside:[{title:"Beschikbaarheid",body:"Hier geef je IK KAN of IK KAN NIET door en ook opbouw- en afbouwbeschikbaarheid.",selector:'input[name="response"]'},{title:"Reden wijzigen",body:"Als je beschikbaarheid verandert, geef je hier de reden door.",selector:'textarea[name="reason"]'}]},
  {title:"Werkplaatsen & shifts",body:"Bekijk je toegewezen werkplek, shifturen en praktische werkplekinformatie.",selector:'[data-layout-key="workplaces"]',route:"/workplaces",inside:[{title:"Werkplekinformatie",body:"Hier vind je omschrijving, bezetting en operationele informatie van je werkplek.",selector:"main h1"},{title:"Shiftinformatie",body:"Je uren en werkplekcontext worden hier aan het evenement gekoppeld.",selector:"main"}]},
  {title:"Mijn werkuren",body:"Hier check je in en uit, start en stop je pauze en volg je je geregistreerde werktijd.",selector:'[data-layout-key="operations"]',route:"/operations",inside:[{title:"Werkstatus",body:"Hier zie je je actieve werk- en pauzetimer en beschikbare tijdsacties.",selector:"main"},{title:"Check-in en werkuren",body:"Hier start en stop je werk en pauze. De rondleiding voert zelf geen tijdsactie uit.",selector:"main"}]},
  {title:"Briefing",body:"Lees de verplichte briefing en bevestig dat je de instructies hebt gelezen.",selector:'[data-layout-key="briefings"]',route:"/briefings",inside:[{title:"Briefing lezen",body:"Lees event- en werkplekinstructies volledig voordat je bevestigt.",selector:"main h1"},{title:"Bevestigen",body:"Met de bevestigingsactie registreer je dat je de instructie hebt gelezen.",selector:'form[action] button'}]},
  {title:"Taken",body:"Bekijk en werk taken af die tijdens je shift aan jou zijn toegewezen.",selector:'[data-layout-key="tasks"]',route:"/tasks",inside:[{title:"Toegewezen taken",body:"Hier staan je operationele taken, omschrijving, deadline en status.",selector:"main"},{title:"Taakstatus",body:"Werk de taakstatus bij wanneer je begint of afrondt.",selector:'form[action] button'}]},
  {title:"Inventaris",body:"Bekijk materiaal van je toegewezen werkplek en de relevante inventarisinformatie.",selector:'[data-layout-key="inventory"]',route:"/inventory",inside:[{title:"Materiaaloverzicht",body:"Bekijk per werkplek welk materiaal aanwezig hoort te zijn.",selector:"main h1"},{title:"Status materiaal",body:"Wanneer jouw rol dit toestaat, meld je hier ontbrekend of defect materiaal.",selector:"main"}]},
  {title:"Inkom & Guestlist",body:"Wanneer je hiervoor wordt ingezet, vind je hier gasten, artiesten en inkominformatie.",selector:'[data-layout-key="guestlist"]',route:"/guestlist",inside:[{title:"Event kiezen",body:"Selecteer het juiste evenement voordat je gasten of artiesten verwerkt.",selector:'select[name="event"]'},{title:"Guestlist",body:"Hier zoek en controleer je gasten, artiesten, spots en notities.",selector:"main"}]},
  {title:"Verkoop",body:"Wanneer je verkooprechten hebt, gebruik je deze functie voor de operationele verkoopregistratie.",selector:'[data-layout-key="sales"]'},
  {title:"Chats",body:"Communiceer met de crew via de beschikbare organisatie-, event- en werkplekchats.",selector:'[data-layout-key="chat"]',route:"/chat",inside:[{title:"Chatkanalen",body:"Kies het juiste organisatie-, event- of werkplekkanaal.",selector:"main"},{title:"Berichten",body:"Gebruik chat voor operationele communicatie met je crew.",selector:"main"}]},
  {title:"Personeel",body:"Bekijk de personeelsinformatie die voor jouw rol beschikbaar is.",selector:'[data-layout-key="crew"]'},
  {title:"Help & incidenten",body:"Tijdens een actieve shift kun je hier hulp vragen of een operationeel incident melden.",selector:'[data-layout-key="incidents"]'},
  {title:"Profiel & instellingen",body:"Beheer je profiel, taal en start deze rondleiding later opnieuw.",selector:'[data-layout-key="settings"]'}],
 responsible_lead:[
  {title:"Welkom, verantwoordelijke",body:"We lopen interactief door alle functies van de rol Verantwoordelijke. Event- en shiftgebonden functies worden tijdens deze rondleiding tijdelijk zichtbaar als preview.",selector:"header"},
  {title:"Overzicht",body:"Hier zie je je eigen status en de operationele informatie van jouw werkplek en ploeg.",selector:'[data-layout-key="overview"]'},
  {title:"Evenementen",body:"Bekijk evenementen, beschikbaarheid en de planning waarvoor je bent ingezet.",selector:'[data-layout-key="events"]'},
  {title:"Werkplaatsen & shifts",body:"Beheer je toegewezen werkplek, shifts, verantwoordelijke context en personeel binnen jouw toegestane scope.",selector:'[data-layout-key="workplaces"]'},
  {title:"Mijn werkuren & check-ins",body:"Beheer je eigen werkuren en de check-inacties waarvoor jij als verantwoordelijke bevoegd bent.",selector:'[data-layout-key="operations"]'},
  {title:"Briefing",body:"Lees en volg de briefing en voorbereiding voor je ploeg.",selector:'[data-layout-key="briefings"]'},
  {title:"Taken",body:"Maak en volg taken voor personeel van jouw eigen werkplek.",selector:'[data-layout-key="tasks"]'},
  {title:"Inventaris",body:"Gebruik de inventaris als opstart- en afsluitchecklist en meld ontbrekend of defect materiaal.",selector:'[data-layout-key="inventory"]'},
  {title:"Inkom & Guestlist",body:"Bekijk en verwerk guestlist- en inkominformatie wanneer dit bij jouw werkplek hoort.",selector:'[data-layout-key="guestlist"]'},
  {title:"Verkoop",body:"Volg of registreer operationele verkoop binnen de rechten van jouw werkplek.",selector:'[data-layout-key="sales"]'},
  {title:"Chats",body:"Communiceer met crew via organisatie-, event- en werkplekchats.",selector:'[data-layout-key="chat"]'},
  {title:"Personeel",body:"Bekijk het personeel en de informatie die binnen jouw rol beschikbaar is.",selector:'[data-layout-key="crew"]'},
  {title:"Help & incidenten",body:"Meld en volg hulpvragen of incidenten tijdens de shift.",selector:'[data-layout-key="incidents"]'},
  {title:"Profiel & instellingen",body:"Beheer profiel en taal en start de rondleiding later opnieuw.",selector:'[data-layout-key="settings"]'}],
 admin:[
  {title:"Welkom in Admin",body:"We lopen interactief door de volledige Admin-omgeving en de belangrijkste beheerfuncties.",selector:"header"},
  {title:"Overzicht",body:"Bekijk actieve crew, operationele status, timers en aandachtspunten.",selector:'[data-layout-key="overview"]'},
  {title:"Evenementen",body:"Maak en beheer evenementen, planning, deadlines, briefing, afsluiting en archivering.",selector:'[data-layout-key="events"]'},
  {title:"Werkplaatsen & shifts",body:"Maak werkplaatsen en shifts, koppel uren en wijs verantwoordelijken en personeel toe.",selector:'[data-layout-key="workplaces"]'},
  {title:"Werkuren",body:"Beheer check-in/out, pauzes, timesheets, correcties en goedkeuringen.",selector:'[data-layout-key="operations"]'},
  {title:"Taken",body:"Maak, wijs toe en volg taken over de toegestane operationele scope.",selector:'[data-layout-key="tasks"]'},
  {title:"Verkoop",body:"Bekijk inkomsten uit merch, kassa/tokens en evenementen.",selector:'[data-layout-key="sales"]'},
  {title:"Goedkeuringen",body:"Keur nieuwe accounts goed en wijs hun initiële rol toe.",selector:'[data-layout-key="personnel"]'},
  {title:"Personeel",body:"Beheer goedgekeurd personeel, rollen, blokkeringen en accounts.",selector:'[data-layout-key="crew"]'},
  {title:"Chats",body:"Beheer en volg de beschikbare crewcommunicatie.",selector:'[data-layout-key="chat"]'},
  {title:"Help & incidenten",body:"Bekijk operationele hulpvragen en incidentmeldingen.",selector:'[data-layout-key="incidents"]'},
  {title:"Beheer",body:"Open profiel-, taal- en centrale beheerinstellingen.",selector:'[data-layout-key="settings"]'},
  {title:"Admin AI",body:"Gebruik Admin AI als contextuele assistent binnen de beheeromgeving.",selector:'button[aria-expanded]'}]}
function storageKey(userId:string,role:UiRole){return "uptilldawn-app-tour:"+userId+":"+role+":v"+VERSION}
export function RoleAppTour(){
 const {user,roles,loading}=useAuth();const role=roles[0];const [tourRole,setTourRole]=useState<UiRole|null>(null);const activeRole=tourRole||role;const steps=useMemo(()=>activeRole?tours[activeRole]:[],[activeRole])
 const [open,setOpen]=useState(false);const [choice,setChoice]=useState(false);const [index,setIndex]=useState(0);const [insideIndex,setInsideIndex]=useState(-1);const [locale,setLocale]=useState<ExtendedUiLocale>(()=>initialUiLocale() as ExtendedUiLocale)
 useEffect(()=>{const on=(event:Event)=>{const next=parseUiLocale((event as CustomEvent<string>).detail);if(next)setLocale(next as ExtendedUiLocale)};addEventListener(LANGUAGE_APPLIED_EVENT,on);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,on)},[])
 const tr=(value:string)=>{const direct=TOUR_TRANSLATIONS[value];if(locale!=="nl"&&direct?.[locale])return direct[locale];return translateRuntimeUi(value,locale)}
 const step=steps[index]
 const detail=insideIndex>=0?step?.inside?.[insideIndex]:null
 const shown=detail||step
 useEffect(()=>{if(loading||!user||!role)return;let alive=true;const check=async()=>{const {data}=await createClient().rpc("upt_current_profile_completion");if(!alive)return;const state=data?.[0];if(state?.required&&!state.completed){if(location.pathname!=="/settings")location.assign("/settings?complete-profile=1");return}const k=storageKey(user.id,role);const saved=localStorage.getItem(k);if(saved==="completed"||saved==="postponed"){setChoice(false);return}if(state?.required&&state.completed){setChoice(true);return}setChoice(false)};void check();const completed=()=>void check();const restart=(event:Event)=>{const requested=(event as CustomEvent<UiRole|undefined>).detail;const nextRole=requested&&tours[requested]?requested:role;setTourRole(nextRole);setIndex(0);setInsideIndex(-1);setChoice(false);setOpen(true);dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active:true,role:nextRole}}))};addEventListener("uptilldawn-profile-completed",completed);addEventListener("uptilldawn-restart-tour",restart);return()=>{alive=false;removeEventListener("uptilldawn-profile-completed",completed);removeEventListener("uptilldawn-restart-tour",restart);dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active:false}}))}},[loading,role,user])
 useEffect(()=>{document.querySelectorAll("[data-upt-tour-highlight]").forEach(el=>el.removeAttribute("data-upt-tour-highlight"));if(!open||!shown)return;if(step?.route&&insideIndex===0&&location.pathname!==step.route){location.assign(step.route);return undefined}const target=document.querySelector(shown.selector) as HTMLElement|null;if(target){target.setAttribute("data-upt-tour-highlight","true");target.scrollIntoView({block:"nearest",behavior:"smooth"})}return()=>target?.removeAttribute("data-upt-tour-highlight")},[index,insideIndex,open,shown,step])
 if(!user||!role)return null
 const setPreview=(active:boolean)=>dispatchEvent(new CustomEvent("uptilldawn-tour-preview",{detail:{active,role:activeRole}}))
 const finish=()=>{localStorage.setItem(storageKey(user.id,role),"completed");setOpen(false);setChoice(false);setPreview(false)}
 const later=()=>{localStorage.setItem(storageKey(user.id,role),"postponed");setChoice(false);setPreview(false)}
 return <>{choice&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true"><section className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl"><h2 className="text-xl font-black">{tr("Welkom bij Up Till Dawn Crew")}</h2><p className="mt-2 text-sm text-muted-foreground">{tr("Wil je een korte rondleiding door de functies die bij jouw rol horen?")}</p><div className="mt-5 flex gap-2"><button onClick={()=>{setChoice(false);setIndex(0);setInsideIndex(-1);setOpen(true);setPreview(true)}} className="flex-1 rounded-xl bg-violet-600 px-4 py-3 font-black text-white">{tr("START RONDLEIDING")}</button><button onClick={later} className="rounded-xl border px-4 py-3 font-bold">{tr("LATER")}</button></div></section></div>}
 {open&&shown&&<div className="fixed inset-0 z-[120] pointer-events-none" aria-live="polite"><div className="absolute inset-0 bg-black/35"/><section className="pointer-events-auto absolute left-3 right-3 top-[max(5.5rem,env(safe-area-inset-top))] mx-auto max-w-sm rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-4 sm:top-24 sm:w-[22rem]"><p className="text-xs font-black uppercase tracking-[.16em] text-violet-400">{tr("Rondleiding")} · {index+1}/{steps.length}</p><h2 className="mt-1 text-xl font-black">{tr(shown.title)}</h2><p className="mt-2 text-sm text-muted-foreground">{tr(shown.body)}</p><div className="mt-5 flex items-center gap-2"><button onClick={finish} className="mr-auto text-sm font-bold text-muted-foreground">{tr("OVERSLAAN")}</button>{(index>0||insideIndex>=0)&&<button onClick={()=>{if(insideIndex>0){setInsideIndex(i=>i-1);return}if(insideIndex===0){setInsideIndex(-1);return}setIndex(i=>Math.max(0,i-1));setInsideIndex(-1)}} className="rounded-xl border px-3 py-2 font-bold">{tr("VORIGE")}</button>}<button onClick={()=>{const details=step?.inside||[];if(insideIndex<0&&details.length){setInsideIndex(0);return}if(insideIndex>=0&&insideIndex<details.length-1){setInsideIndex(i=>i+1);return}setInsideIndex(-1);index===steps.length-1?finish():setIndex(i=>i+1)}} className="rounded-xl bg-violet-600 px-4 py-2 font-black text-white">{tr(index===steps.length-1&&insideIndex>=(step?.inside?.length||0)-1?"KLAAR":"VOLGENDE")}</button></div></section></div>}</>
}
export function RestartRoleTourButton(){const {isOwner}=useAuth();const start=(role?:UiRole)=>dispatchEvent(new CustomEvent("uptilldawn-restart-tour",{detail:role}));if(!isOwner)return <button type="button" onClick={()=>start()} className="rounded-xl border px-4 py-3 font-bold">RONDLEIDING OPNIEUW STARTEN</button>;return <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>start("admin")} className="rounded-xl border px-4 py-3 font-bold">ADMIN RONDLEIDING</button><button type="button" onClick={()=>start("responsible_lead")} className="rounded-xl border px-4 py-3 font-bold">VERANTWOORDELIJKE RONDLEIDING</button><button type="button" onClick={()=>start("employee")} className="rounded-xl border px-4 py-3 font-bold">PERSONEEL RONDLEIDING</button></div>}
