"use client"

import {usePathname} from "next/navigation"
import {useEffect,useState} from "react"
import {parseUiLocale,LANGUAGE_APPLIED_EVENT} from "@/lib/locale-preferences"
import {useAuth,useDisplayName} from "@/lib/providers"
import {tourProgressKey} from "@/lib/tour-training"
import {readDemoScenario,type DemoScenario} from "@/lib/training-demo-scenario"

type Role="employee"|"responsible_lead"|"admin"
type Locale="nl"|"en"|"fr"|"de"
const t=(locale:Locale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[locale])
const crewNames=["Lina Peeters","Noah Jacobs","Mila Vermeulen"]

export function TourActiveEventDemo({role}:{role:Role}){
 const pathname=usePathname()
 const {profile}=useAuth()
 const displayName=useDisplayName()
 const [locale,setLocale]=useState<Locale>("nl")
 const [scenario,setScenario]=useState<DemoScenario|null>(null)
 useEffect(()=>{
   const refresh=()=>{
     const workplace=sessionStorage.getItem("uptilldawn-training-preferred-workplace")||""
     if(profile?.id)setScenario(readDemoScenario(tourProgressKey(profile.id,role,workplace)))
   }
   const frame=requestAnimationFrame(refresh)
   addEventListener("uptilldawn-training-demo-updated",refresh)
   return()=>{cancelAnimationFrame(frame);removeEventListener("uptilldawn-training-demo-updated",refresh)}
 },[profile?.id,role])
 const [operationStep,setOperationStep]=useState(0)
 useEffect(()=>{const on=(event:Event)=>{const next=parseUiLocale((event as CustomEvent<string>).detail);if(next)setLocale(next as Locale)};const initial=parseUiLocale(document.documentElement.lang);if(initial)queueMicrotask(()=>setLocale(initial as Locale));addEventListener(LANGUAGE_APPLIED_EVENT,on);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,on)},[])
 const heading=t(locale,"DEMO · ACTIEF EVENEMENT","DEMO · ACTIVE EVENT","DÉMO · ÉVÉNEMENT ACTIF","DEMO · AKTIVES EVENT")
 const event=scenario?.eventName||t(locale,"Up Till Dawn — Demo Night","Up Till Dawn — Demo Night","Up Till Dawn — Demo Night","Up Till Dawn — Demo Night")
 const workplace=role==="admin"
  ? t(locale,"Alle werkplekken","All workplaces","Tous les postes","Alle Arbeitsplätze")
  : role==="responsible_lead"
    ? t(locale,"Main Bar · verantwoordelijke","Main Bar · responsible lead","Bar principal · responsable","Hauptbar · verantwortlich")
    : scenario?.workplaceName||t(locale,"Main Bar","Main Bar","Bar principal","Hauptbar")
 const names=[displayName,...crewNames.filter(name=>name!==displayName)]
 const personLabel=profile?.full_name||displayName
 const badge=<span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] font-black text-violet-500">{heading}</span>
 const nextChapter=pathname==="/"||pathname==="/admin"?(role==="admin"?"personnel":"events"):pathname.startsWith("/events")?"workplaces":pathname.startsWith("/workplaces")?"briefings":pathname.startsWith("/briefings")?"operations":null
 const advance=()=>{
  if(!nextChapter)return
  let state:Record<string,unknown>={}
  try{state=JSON.parse(sessionStorage.getItem("uptilldawn-training-workflow-v3")||"{}")}catch{}
  sessionStorage.setItem("uptilldawn-training-workflow-v3",JSON.stringify({...state,eventOpened:true,navTarget:nextChapter,...(nextChapter==="operations"?{briefingRead:true}:{}),...(nextChapter==="workplaces"?{availability:true,assigned:true}:{})}))
  dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:nextChapter}}))
 }
 let body=<>
  <div className="mb-3 rounded-xl border border-violet-500/30 p-3"><p className="text-xs text-muted-foreground">{t(locale,"Jij in deze demo","You in this demo","Vous dans cette démo","Du in dieser Demo")}</p><p className="font-black">{personLabel}</p><p className="text-sm">{role==="admin"?t(locale,"Admin · beheert dit actieve evenement","Admin · managing this live event","Admin · gère cet événement actif","Admin · verwaltet dieses aktive Event"):role==="responsible_lead"?t(locale,"Verantwoordelijke · Main Bar","Responsible lead · Main Bar","Responsable · Bar principal","Verantwortlich · Hauptbar"):t(locale,"Personeel · Main Bar · shift 22:00–04:00","Staff · Main Bar · shift 22:00–04:00","Personnel · Bar principal · shift 22:00–04:00","Personal · Hauptbar · Schicht 22:00–04:00")}</p></div><div className="grid gap-3 sm:grid-cols-3">
   <article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t(locale,"Evenement","Event","Événement","Event")}</p><p className="font-black">{event}</p><p className="text-sm text-emerald-600">{t(locale,"Nu actief · 22:00–06:00","Live now · 22:00–06:00","Actif maintenant · 22:00–06:00","Jetzt aktiv · 22:00–06:00")}</p></article>
   <article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{role==="admin"?t(locale,"Werkplekken","Workplaces","Postes","Arbeitsplätze"):t(locale,"Jouw werkplek","Your workplace","Votre poste","Dein Arbeitsplatz")}</p><p className="font-black">{workplace}</p><p className="text-sm">{role==="admin"?t(locale,"6 actief · 24 crew","6 active · 24 crew","6 actifs · 24 équipiers","6 aktiv · 24 Crew"):t(locale,"Shift 22:00–04:00","Shift 22:00–04:00","Shift 22:00–04:00","Schicht 22:00–04:00")}</p></article>
   <article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t(locale,"Status","Status","Statut","Status")}</p><p className="font-black">{role==="admin"?t(locale,"Event operationeel","Event operational","Événement opérationnel","Event betriebsbereit"):role==="responsible_lead"?t(locale,"Werkplek actief","Workplace active","Poste actif","Arbeitsplatz aktiv"):t(locale,"Ingecheckt","Checked in","Enregistré","Eingecheckt")}</p><p className="text-sm">{role==="admin"?t(locale,"2 openstaande acties","2 pending actions","2 actions en attente","2 offene Aktionen"):role==="responsible_lead"?t(locale,"4/5 personeel actief","4/5 staff active","4/5 personnel actifs","4/5 Personal aktiv"):t(locale,"Werk 01:42:18","Work 01:42:18","Travail 01:42:18","Arbeit 01:42:18")}</p></article>
  </div>
 </>
 if(pathname.startsWith("/operations")){
  const operationActions=role==="admin"?[
   t(locale,"ACTIEVE CREW OPENEN","OPEN ACTIVE CREW","OUVRIR L’ÉQUIPE ACTIVE","AKTIVE CREW ÖFFNEN"),
   t(locale,"URENSTAAT CONTROLEREN","REVIEW TIMESHEET","VÉRIFIER LA FEUILLE D’HEURES","STUNDENZETTEL PRÜFEN"),
   t(locale,"CORRECTIE TOEPASSEN","APPLY CORRECTION","APPLIQUER LA CORRECTION","KORREKTUR ANWENDEN"),
   t(locale,"UREN GOEDKEUREN","APPROVE HOURS","APPROUVER LES HEURES","STUNDEN GENEHMIGEN"),
   t(locale,"URENSTAAT LOCKEN","LOCK TIMESHEET","VERROUILLER LA FEUILLE","STUNDENZETTEL SPERREN"),
  ]:role==="responsible_lead"?[
   t(locale,"AANWIJZING BEVESTIGEN","CONFIRM CHECK-IN","CONFIRMER L’AFFECTATION","ZUWEISUNG BESTÄTIGEN"),
   t(locale,"START WERK","START WORK","DÉMARRER LE TRAVAIL","ARBEIT STARTEN"),
   t(locale,"START PAUZE","START BREAK","DÉMARRER LA PAUSE","PAUSE STARTEN"),
   t(locale,"STOP PAUZE","STOP BREAK","TERMINER LA PAUSE","PAUSE BEENDEN"),
   t(locale,"STOP WERK & CONTROLEER URENSTAAT","STOP WORK & REVIEW TIMESHEET","ARRÊTER LE TRAVAIL ET VÉRIFIER LA FEUILLE","ARBEIT STOPPEN & STUNDENZETTEL PRÜFEN"),
  ]:[
   t(locale,"AANWIJZING BEVESTIGEN","CONFIRM CHECK-IN","CONFIRMER L’AFFECTATION","ZUWEISUNG BESTÄTIGEN"),
   t(locale,"START WERK","START WORK","DÉMARRER LE TRAVAIL","ARBEIT STARTEN"),
   t(locale,"START PAUZE","START BREAK","DÉMARRER LA PAUSE","PAUSE STARTEN"),
   t(locale,"STOP PAUZE","STOP BREAK","TERMINER LA PAUSE","PAUSE BEENDEN"),
   t(locale,"STOP WERK","STOP WORK","ARRÊTER LE TRAVAIL","ARBEIT STOPPEN"),
   t(locale,"URENSTAAT INDIENEN","SUBMIT TIMESHEET","SOUMETTRE LA FEUILLE D’HEURES","STUNDENZETTEL SENDEN"),
  ]
  const operationDone=operationStep>=operationActions.length
  const runOperation=()=>{
   if(operationDone)return
   const nextStep=operationStep+1
   setOperationStep(nextStep)
   if(nextStep>=operationActions.length){
    let state:Record<string,unknown>={}
    try{state=JSON.parse(sessionStorage.getItem("uptilldawn-training-workflow-v3")||"{}")}catch{}
    sessionStorage.setItem("uptilldawn-training-workflow-v3",JSON.stringify({...state,operationComplete:true,navTarget:"tasks"}))
    dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:"tasks"}}))
   }
  }
  body=<div data-tour-demo="time-actions" className="grid gap-3">
   <div className="flex flex-wrap items-center gap-2">{badge}<strong>{event}</strong><span>·</span><span>{workplace}</span></div>
   <div className="grid gap-3 sm:grid-cols-3"><article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t(locale,"Workflow","Workflow","Workflow","Workflow")}</p><p className="font-black">{Math.min(operationStep+1,operationActions.length)}/{operationActions.length}</p></article><article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t(locale,"Pauzeregel","Break rule","Règle de pause","Pausenregel")}</p><p className="font-black">{t(locale,"1 uur verplicht","1 hour required","1 heure obligatoire","1 Stunde Pflicht")}</p></article><article className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t(locale,"Demo","Demo","Démo","Demo")}</p><p className="font-black text-emerald-600">{t(locale,"Geen echte uren gewijzigd","No real hours changed","Aucune heure réelle modifiée","Keine echten Stunden geändert")}</p></article></div>
   <button data-tour-demo="primary-action" type="button" disabled={operationDone} onClick={runOperation} className="w-fit rounded-xl border border-violet-500/50 px-4 py-3 text-sm font-black disabled:opacity-60">{operationDone?t(locale,"WORKFLOW VOLTOOID","WORKFLOW COMPLETE","WORKFLOW TERMINÉ","WORKFLOW ABGESCHLOSSEN"):operationActions[operationStep]}</button>
  </div>
 }
 else if(pathname.startsWith("/workplaces"))body=<div data-tour-demo="shift" className="grid gap-3">
  <div className="flex flex-wrap items-center gap-2">{badge}<strong>{event}</strong></div>
  <div className="grid gap-3 md:grid-cols-2"><article className="rounded-xl border p-4"><h3 className="font-black">Main Bar</h3><p className="text-sm text-muted-foreground">{t(locale,"Verantwoordelijke: Lina Peeters · 4/5 personeel","Responsible: Lina Peeters · 4/5 staff","Responsable : Lina Peeters · 4/5 personnel","Verantwortlich: Lina Peeters · 4/5 Personal")}</p><p className="mt-2 text-sm">22:00–04:00 · {t(locale,"Actieve shift","Active shift","Shift actif","Aktive Schicht")}</p></article><article className="rounded-xl border p-4"><h3 className="font-black">{t(locale,"Crew op deze werkplek","Crew at this workplace","Équipe à ce poste","Crew an diesem Arbeitsplatz")}</h3>{names.map((n,i)=><p key={n} className="mt-1 text-sm">{n} · {i===2?t(locale,"Pauze 00:18","Break 00:18","Pause 00:18","Pause 00:18"):t(locale,"Aan het werk","Working","Au travail","Bei der Arbeit")}</p>)}</article></div>
 </div>
 else if(pathname.startsWith("/briefings"))body=<div data-tour-demo className="grid gap-2"><div className="flex items-center gap-2">{badge}<strong>{t(locale,"Briefing Main Bar","Main Bar briefing","Briefing Bar principal","Briefing Hauptbar")}</strong></div><p>{t(locale,"Controleer voorraad, open twee kassa’s, draag polsbandje en meld incidenten direct aan de verantwoordelijke.","Check stock, open two tills, wear your wristband and report incidents directly to the responsible lead.","Contrôlez le stock, ouvrez deux caisses, portez votre bracelet et signalez immédiatement les incidents au responsable.","Bestand prüfen, zwei Kassen öffnen, Armband tragen und Vorfälle direkt der verantwortlichen Person melden.")}</p><p className="text-sm text-emerald-600">✓ {t(locale,"3/4 crew bevestigd","3/4 crew confirmed","3/4 équipe confirmée","3/4 Crew bestätigt")}</p></div>
 else if(pathname.startsWith("/tasks"))body=<div data-tour-demo className="grid gap-2"><div className="flex items-center gap-2">{badge}<strong>{t(locale,"Taken tijdens actieve shift","Tasks during active shift","Tâches pendant le shift actif","Aufgaben während aktiver Schicht")}</strong></div>{[[t(locale,"Koeling aanvullen","Restock coolers","Réapprovisionner les frigos","Kühlungen auffüllen"),"Lina Peeters"],[t(locale,"Kassa 2 controleren","Check till 2","Contrôler caisse 2","Kasse 2 prüfen"),"Noah Jacobs"]].map(([a,b])=><article key={a} className="rounded-xl border p-3"><b>{a}</b><p className="text-sm text-muted-foreground">{b} · {t(locale,"Bezig","In progress","En cours","In Arbeit")}</p></article>)}</div>
 else if(pathname.startsWith("/inventory"))body=<div data-tour-demo className="grid gap-2"><div className="flex items-center gap-2">{badge}<strong>Main Bar · {t(locale,"Inventaris","Inventory","Inventaire","Inventar")}</strong></div><div className="grid grid-cols-2 gap-2 text-sm"><p>Bekers · 480/500</p><p>Tokens · 1200/1200</p><p>Scanner · 2/2</p><p className="text-amber-600">Bar mat · 3/4</p></div></div>
 else if(pathname.startsWith("/guestlist"))body=<div data-tour-demo className="grid gap-2"><div className="flex items-center gap-2">{badge}<strong>{t(locale,"Inkom & Guestlist","Entrance & Guest list","Entrée & Liste invités","Eingang & Gästeliste")}</strong></div><p className="text-sm">Amelie Vos · Guest · 2 spots · ✓</p><p className="text-sm">DJ Nova · Artist · 3 spots · {t(locale,"Nog niet binnen","Not arrived","Pas encore arrivé","Noch nicht angekommen")}</p></div>
 else if(pathname.startsWith("/sales"))body=<div data-tour-demo className="grid gap-2"><div className="flex items-center gap-2">{badge}<strong>{t(locale,"Live verkoop","Live sales","Ventes en direct","Live-Verkauf")}</strong></div><div className="grid grid-cols-3 gap-2 text-sm"><p>Tokens €1.240</p><p>Merch €385</p><p>{t(locale,"Totaal","Total","Total","Gesamt")} €1.625</p></div></div>
 return <section data-no-translate data-tour-demo="training-screen" data-demo-person={personLabel} className="mx-auto min-h-full w-full max-w-5xl p-4 sm:p-6" aria-label={heading}><div className="mb-3 flex items-center justify-between gap-2">{badge}<span className="text-xs text-muted-foreground">{role==="admin"?"Admin":role==="responsible_lead"?t(locale,"Verantwoordelijke","Responsible","Responsable","Verantwortlich"):t(locale,"Personeel","Staff","Personnel","Personal")}</span></div>{body}{nextChapter&&<button data-tour-demo="primary-action" type="button" onClick={advance} className="mt-5 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white">{nextChapter==="personnel"?t(locale,"OPEN GOEDKEURINGEN","OPEN APPROVALS","OUVRIR LES APPROBATIONS","GENEHMIGUNGEN ÖFFNEN"):nextChapter==="events"?t(locale,"BEKIJK HET DEMO-EVENEMENT","VIEW THE DEMO EVENT","VOIR L’ÉVÉNEMENT DÉMO","DEMO-EVENT ANSEHEN"):nextChapter==="workplaces"?t(locale,"BEKIJK DE DEMO-PLANNING","VIEW THE DEMO SCHEDULE","VOIR LE PLANNING DÉMO","DEMO-PLANUNG ANSEHEN"):nextChapter==="briefings"?t(locale,"OPEN DE DEMO-BRIEFING","OPEN THE DEMO BRIEFING","OUVRIR LE BRIEFING DÉMO","DEMO-BRIEFING ÖFFNEN"):t(locale,"BRIEFING GELEZEN EN BEVESTIGD","BRIEFING READ AND CONFIRMED","BRIEFING LU ET CONFIRMÉ","BRIEFING GELESEN UND BESTÄTIGT")}</button>}</section>
}
