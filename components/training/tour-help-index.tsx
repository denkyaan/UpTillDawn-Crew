"use client"

import {useEffect,useMemo,useState} from "react"
import {useAuth,type UiRole} from "@/lib/providers"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {getTourChapters,tourProgressKey,TOUR_VERSION,TOUR_WORKFLOW_KEY,type TourMode,type TourRole,type TourScenario} from "@/lib/tour-training"

type Progress={version:number;activeKey:string;completed:string[];skipped:string[];paused:boolean}
const c=(locale:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[locale])

function progressFor(userId:string,role:TourRole,first:string){
  if(typeof window==="undefined")return {version:TOUR_VERSION,activeKey:first,completed:[],skipped:[],paused:false} satisfies Progress
  try{
    const value=JSON.parse(localStorage.getItem(tourProgressKey(userId,role))||"null") as Progress|null
    if(value?.version===TOUR_VERSION)return value
  }catch{}
  return {version:TOUR_VERSION,activeKey:first,completed:[],skipped:[],paused:false} satisfies Progress
}

export function TourHelpIndex(){
  const {user,roles,isOwner,realIsAdmin,setRoleMode}=useAuth()
  const role=(roles[0]||"employee") as TourRole
  const [locale,setLocale]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
  const [preferred,setPreferred]=useState(()=>typeof window==="undefined"?"":sessionStorage.getItem("uptilldawn-training-preferred-workplace")||"")
  const [refresh,setRefresh]=useState(0)
  useEffect(()=>{const apply=()=>setLocale(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,apply);const changed=()=>setRefresh(v=>v+1);addEventListener("uptilldawn-tour-finished",changed);addEventListener("storage",changed);return()=>{removeEventListener(LANGUAGE_APPLIED_EVENT,apply);removeEventListener("uptilldawn-tour-finished",changed);removeEventListener("storage",changed)}},[])
  const driver=/driver/i.test(preferred)
  const entrance=/inkom|entrance|guest/i.test(preferred)
  const chapters=useMemo(()=>getTourChapters(role,{driver,entrance}),[driver,entrance,role,refresh])
  const progress=user?progressFor(user.id,role,chapters[0]?.key||"overview"):null
  if(!user||!progress)return null

  const start=async(targetRole:UiRole=role,options?:{workplace?:string;chapter?:string;mode?:TourMode;scenario?:TourScenario})=>{
    if(targetRole!==roles[0]&&realIsAdmin)await setRoleMode(targetRole)
    const workplace=options?.workplace??preferred
    if(workplace){sessionStorage.setItem("uptilldawn-training-preferred-workplace",workplace);setPreferred(workplace)}
    if(options?.scenario){
      let workflow:Record<string,unknown>={}
      try{workflow=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}")}catch{}
      const phase=options.scenario==="break"?"break":options.scenario==="post_event"?"finished":options.scenario==="live_event"?"working":"assigned"
      const seeded=options.scenario==="pre_event"
        ?{eventOpened:false,availability:false,assigned:false,briefingRead:false,operationPhase:phase,navTarget:"events"}
        :{...workflow,eventOpened:true,availability:true,assigned:true,briefingRead:true,operationPhase:phase,navTarget:null,trainingComplete:false}
      sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify(seeded))
    }
    const nextRole=targetRole as TourRole
    const nextChapters=getTourChapters(nextRole,{driver:/driver/i.test(workplace),entrance:/inkom|entrance|guest/i.test(workplace),mode:options?.mode||"full"})
    const key=tourProgressKey(user.id,nextRole)
    const existing=progressFor(user.id,nextRole,nextChapters[0]?.key||"overview")
    const activeKey=options?.chapter&&nextChapters.some(chapter=>chapter.key===options.chapter)?options.chapter:existing.activeKey
    localStorage.setItem(key,JSON.stringify({...existing,activeKey,paused:false}))
    dispatchEvent(new CustomEvent("uptilldawn-restart-tour",{detail:{role:targetRole,workplace,chapter:activeKey,mode:options?.mode||"full",scenario:options?.scenario}}))
  }

  const fresh=chapters.filter(chapter=>chapter.newSince===TOUR_VERSION&&!progress.completed.includes(chapter.key))
  const completed=chapters.filter(chapter=>progress.completed.includes(chapter.key)).length
  const percent=Math.round(completed/Math.max(1,chapters.length)*100)

  return <main data-no-translate className="mx-auto max-w-5xl space-y-6 p-4 pb-28 md:p-8">
    <header><p className="text-xs font-black uppercase tracking-[.2em] text-violet-500">{c(locale,"HELP & RONDLEIDINGEN","HELP & TOURS","AIDE & VISITES","HILFE & RUNDGÄNGE")}</p><h1 className="mt-1 text-3xl font-black">{c(locale,"Interactieve opleiding","Interactive training","Formation interactive","Interaktives Training")}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{c(locale,"Doorloop UpTillDawn alsof er een echt evenement actief is. Alle acties gebruiken fictieve sandboxgegevens en wijzigen geen productiegegevens.","Walk through UpTillDawn as if a real event were live. All actions use fictional sandbox data and do not change production data.","Parcourez UpTillDawn comme si un véritable événement était actif. Toutes les actions utilisent des données fictives du sandbox et ne modifient aucune donnée de production.","Durchlaufe UpTillDawn, als wäre ein echtes Event aktiv. Alle Aktionen verwenden fiktive Sandboxdaten und ändern keine Produktionsdaten.")}</p></header>

    <section className="rounded-2xl border p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">{c(locale,"Voortgang huidige rol","Current role progress","Progression du rôle actuel","Fortschritt der aktuellen Rolle")}</p><h2 className="text-xl font-black">{role==="admin"?"Admin":role==="responsible_lead"?c(locale,"Verantwoordelijke","Responsible","Responsable","Verantwortlich"):c(locale,"Personeel","Staff","Personnel","Personal")}</h2></div><span className="text-2xl font-black">{percent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-violet-500" style={{width:percent+"%"}}/></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void start(role)} className="rounded-xl bg-violet-600 px-4 py-3 font-black text-white">{progress.paused?c(locale,"HERVATTEN","RESUME","REPRENDRE","FORTSETZEN"):c(locale,"RONDLEIDING STARTEN","START TOUR","COMMENCER LA VISITE","RUNDGANG STARTEN")}</button>{fresh.length>0&&<button onClick={()=>void start(role,{mode:"new",chapter:fresh[0].key})} className="rounded-xl border border-emerald-500/50 px-4 py-3 font-black text-emerald-500">{c(locale,"WAT IS ER NIEUW","WHAT'S NEW","NOUVEAUTÉS","WAS IST NEU")} · {fresh.length}</button>}</div></section>

    <section className="space-y-3"><div><h2 className="text-xl font-black">{c(locale,"Scenario’s","Scenarios","Scénarios","Szenarien")}</h2><p className="text-sm text-muted-foreground">{c(locale,"Start onmiddellijk in een specifieke eventfase.","Start immediately in a specific event phase.","Commencez immédiatement dans une phase spécifique de l’événement.","Starte direkt in einer bestimmten Eventphase.")}</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
      ["pre_event","events",c(locale,"Vóór event","Before event","Avant événement","Vor Event")],
      ["live_event","operations",c(locale,"Lopend event","Live event","Événement actif","Aktives Event")],
      ["break","operations",c(locale,"Tijdens pauze","During break","Pendant la pause","Während Pause")],
      ["post_event","settings",c(locale,"Na event","After event","Après événement","Nach Event")],
    ].map(([scenario,chapter,label])=><button key={scenario} onClick={()=>void start(role,{chapter,scenario:scenario as TourScenario})} className="rounded-2xl border p-4 text-left font-black hover:border-violet-500/60">{label}</button>)}</div></section>

    {isOwner&&<section className="space-y-3 rounded-2xl border border-violet-500/40 p-4"><div><h2 className="text-xl font-black">God Mode · {c(locale,"rolpreview","role preview","aperçu des rôles","Rollenvorschau")}</h2><p className="text-sm text-muted-foreground">{c(locale,"De preview schakelt de echte UI-rolmodus om maar blijft in de fictieve trainingssandbox.","The preview switches the real UI role mode but remains inside the fictional training sandbox.","L’aperçu change le véritable mode de rôle de l’interface mais reste dans le sandbox fictif.","Die Vorschau wechselt den echten UI-Rollenmodus, bleibt aber in der fiktiven Trainingssandbox.")}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void start("admin",{workplace:""})} className="rounded-xl border px-4 py-3 font-black">ADMIN</button><button onClick={()=>void start("responsible_lead",{workplace:"Bar / Toog"})} className="rounded-xl border px-4 py-3 font-black">{c(locale,"VERANTWOORDELIJKE","RESPONSIBLE","RESPONSABLE","VERANTWORTLICH")}</button><button onClick={()=>void start("employee",{workplace:"Bar / Toog"})} className="rounded-xl border px-4 py-3 font-black">{c(locale,"PERSONEEL","STAFF","PERSONNEL","PERSONAL")}</button><button onClick={()=>void start("employee",{workplace:"Driver",chapter:"driver"})} className="rounded-xl border px-4 py-3 font-black">DRIVER</button></div></section>}

    <section className="space-y-3"><h2 className="text-xl font-black">{c(locale,"Hoofdstukken","Chapters","Chapitres","Kapitel")}</h2><div className="grid gap-2">{chapters.map((chapter,index)=>{const done=progress.completed.includes(chapter.key),skipped=progress.skipped.includes(chapter.key),isNew=chapter.newSince===TOUR_VERSION&&!done;return <button key={chapter.key} onClick={()=>void start(role,{chapter:chapter.key})} className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-violet-500/60"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black">{done?"✓":skipped?"–":index+1}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-black">{chapter.title[locale]}{isNew&&<span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[9px] text-emerald-500">{c(locale,"NIEUW","NEW","NOUVEAU","NEU")}</span>}</span><span className="mt-1 block text-xs text-muted-foreground">{chapter.description[locale]}</span></span></button>})}</div></section>

    <section className="rounded-2xl border p-4 text-sm text-muted-foreground"><p className="font-bold text-foreground">{c(locale,"Veilige trainingsmodus","Safe training mode","Mode de formation sûr","Sicherer Trainingsmodus")}</p><p className="mt-2">{c(locale,"Push-, locatie-, camera- en selfiepermissies worden tijdens de demo niet echt aangevraagd. Ontbrekende tourdoelen herstellen automatisch naar de pagina en worden technisch gelogd voor Error AI.","Push, location, camera and selfie permissions are not actually requested during the demo. Missing tour targets automatically recover to the page and are technically logged for Error AI.","Les autorisations push, localisation, caméra et selfie ne sont pas réellement demandées pendant la démo. Les cibles de visite manquantes reviennent automatiquement à la page et sont journalisées pour Error AI.","Push-, Standort-, Kamera- und Selfie-Berechtigungen werden während der Demo nicht tatsächlich angefordert. Fehlende Tourziele werden automatisch auf die Seite zurückgesetzt und für Error AI protokolliert.")}</p></section>
  </main>
}
