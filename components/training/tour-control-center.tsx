"use client"

import {useCallback,useEffect,useMemo,useRef,useState} from "react"
import {usePathname,useRouter} from "next/navigation"
import {tourPanelLayout} from "@/lib/tour-panel-layout"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"
import {
  TOUR_SESSION_KEY,
  TOUR_VERSION,
  TOUR_WORKFLOW_KEY,
  chapterForPath,
  getTourChapters,
  tourBaseRoute,
  tourProgressKey,
  tourRoute,
  type TourChapter,
  type TourMode,
  type TourRole,
  type TourScenario,
} from "@/lib/tour-training"

type Progress={version:number;activeKey:string;completed:string[];skipped:string[];paused:boolean;updatedAt:string}
type Rect={left:number;top:number;width:number;height:number}
const c=(locale:SupportedUiLocale,nl:string,en:string,fr:string,de:string)=>({nl,en,fr,de}[locale])
const unique=(values:string[])=>[...new Set(values)]

function readProgress(key:string,defaultKey:string):Progress{
  const fallback:Progress={version:TOUR_VERSION,activeKey:defaultKey,completed:[],skipped:[],paused:false,updatedAt:new Date().toISOString()}
  if(typeof window==="undefined")return fallback
  try{
    const parsed=JSON.parse(localStorage.getItem(key)||"null") as Partial<Progress>|null
    if(!parsed||parsed.version!==TOUR_VERSION)return fallback
    return {...fallback,...parsed,completed:Array.isArray(parsed.completed)?parsed.completed:[],skipped:Array.isArray(parsed.skipped)?parsed.skipped:[]}
  }catch{return fallback}
}

function setWorkflow(patch:Record<string,unknown>){
  let state:Record<string,unknown>={}
  try{state=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}")}catch{}
  sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify({...state,...patch}))
}
function clearTrainingNavTarget(){
  setWorkflow({navTarget:null})
  dispatchEvent(new CustomEvent("uptilldawn-training-nav-target",{detail:{target:undefined}}))
}
function seedScenario(scenario:TourScenario){
  if(scenario==="pre_event"){sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify({eventOpened:false,availability:false,assigned:false,briefingRead:false,operationPhase:"assigned",navTarget:"events"}));return}
  if(scenario==="live_event"){setWorkflow({eventOpened:true,availability:true,assigned:true,briefingRead:true,operationPhase:"working",navTarget:null,trainingComplete:false});return}
  if(scenario==="break"){setWorkflow({eventOpened:true,availability:true,assigned:true,briefingRead:true,operationPhase:"break",navTarget:null,trainingComplete:false});return}
  if(scenario==="post_event")setWorkflow({eventOpened:true,availability:true,assigned:true,briefingRead:true,operationPhase:"finished",navTarget:null,trainingComplete:false})
}
async function reportMissingTarget(chapter:TourChapter,selector:string){
  const key="uptilldawn-tour-missing:"+TOUR_VERSION+":"+chapter.key+":"+selector
  try{
    if(sessionStorage.getItem(key)==="1")return
    sessionStorage.setItem(key,"1")
    await fetch("/api/error-reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      route:location.pathname+location.search,errorName:"TourTargetMissing",
      errorMessage:"Guided-tour target missing for "+chapter.key+": "+selector,stackTrace:"",source:"api",
      clientContext:{tourVersion:TOUR_VERSION,chapter:chapter.key,selector,viewport:{width:innerWidth,height:innerHeight}},
    })})
  }catch{}
}

export function TourControlCenter({active,userId,role,preferredWorkplace,mode="full"}:{active:boolean;userId:string;role:TourRole;preferredWorkplace:string;mode?:TourMode}){
  const router=useRouter()
  const pathname=usePathname()
  const driver=/driver/i.test(preferredWorkplace)
  const entrance=/inkom|entrance|guest/i.test(preferredWorkplace)
  const chapters=useMemo(()=>getTourChapters(role,{driver,entrance,mode}),[driver,entrance,mode,role])
  const progressKey=tourProgressKey(userId,role)
  const [locale,setLocale]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
  const [progress,setProgress]=useState<Progress>(()=>readProgress(progressKey,chapters[0]?.key||"overview"))
  const [indexOpen,setIndexOpen]=useState(false)
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [rect,setRect]=useState<Rect|null>(null)
  const [targetReady,setTargetReady]=useState(false)
  const [targetMissing,setTargetMissing]=useState(false)
  const pendingPathRef=useRef<string|null>(null)
  const progressRef=useRef(progress)
  useEffect(()=>{progressRef.current=progress},[progress])
  const write=useCallback((next:Progress)=>{progressRef.current=next;setProgress(next);localStorage.setItem(progressKey,JSON.stringify(next))},[progressKey])

  useEffect(()=>{const apply=()=>setLocale(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
  useEffect(()=>{
    if(!active||!chapters.length)return
    sessionStorage.setItem(TOUR_SESSION_KEY,JSON.stringify({active:true,role,mode}))
    const restored=readProgress(progressKey,chapters[0].key)
    const chapter=chapters.find(item=>item.key===restored.activeKey)||chapters[0]
    const next={...restored,activeKey:chapter.key}
    pendingPathRef.current=tourBaseRoute(role,chapter)
    router.push(tourRoute(role,chapter))
    const frame=requestAnimationFrame(()=>{
      write({...next,paused:false,updatedAt:new Date().toISOString()})
    })
    return()=>cancelAnimationFrame(frame)
  },[active,chapters,mode,progressKey,role,router,write])

  const current=chapters.find(chapter=>chapter.key===progress.activeKey)||chapters[0]
  const currentIndex=Math.max(0,chapters.findIndex(chapter=>chapter.key===current?.key))
  useEffect(()=>{
    if(!active||!current)return
    const expected=tourBaseRoute(role,current)
    if(pendingPathRef.current){
      if(pathname!==pendingPathRef.current)return
      pendingPathRef.current=null
    }
    if(pathname!==expected){
      const routeChapter=chapterForPath(role,pathname,chapters)
      if(routeChapter&&tourBaseRoute(role,current)!==pathname){
        const prior=progressRef.current
        const completed=prior.activeKey&&prior.activeKey!==routeChapter.key?unique([...prior.completed,prior.activeKey]):prior.completed
        write({...prior,activeKey:routeChapter.key,completed,updatedAt:new Date().toISOString()})
      }else router.push(tourRoute(role,current))
    }
  },[active,chapters,current,pathname,role,router,write])

  useEffect(()=>{
    if(!active||!current)return
    let stopped=false
    let observer:MutationObserver|undefined
    let timeout=0
    let frame=0
    let located=false
    const resetFrame=requestAnimationFrame(()=>{setTargetReady(false);setTargetMissing(false)})
    const mobile=matchMedia("(max-width: 1023px)").matches
    const selector=mobile?current.mobileSelector:current.desktopSelector
    const updateRect=(element:Element)=>{
      const target=element as HTMLElement
      if(!located)target.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"})
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{if(stopped)return;const r=target.getBoundingClientRect();setRect({left:Math.max(4,r.left-5),top:Math.max(4,r.top-5),width:Math.max(24,r.width+10),height:Math.max(24,r.height+10)})})
    }
    const locate=()=>{
      const container=document.querySelector(selector)
      const found=document.querySelector('[data-tour-demo="primary-action"]:not(:disabled)')||container?.querySelector('button:not(:disabled), summary, input:not(:disabled)')||container
      if(found){const style=getComputedStyle(found);if(style.display!=="none"&&style.visibility!=="hidden"&&found.getClientRects().length){cancelAnimationFrame(resetFrame);setTargetReady(true);setTargetMissing(false);updateRect(found);located=true;return true}}
      return false
    }
    if(!locate()){
      observer=new MutationObserver(()=>{if(locate())observer?.disconnect()})
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style","hidden"]})
      timeout=window.setTimeout(()=>{if(stopped||locate())return;setTargetReady(false);setTargetMissing(true);setRect(null);void reportMissingTarget(current,selector)},8000)
    }
    const onResize=()=>{locate()}
    addEventListener("resize",onResize)
    addEventListener("scroll",onResize,true)
    return()=>{stopped=true;observer?.disconnect();window.clearTimeout(timeout);cancelAnimationFrame(frame);cancelAnimationFrame(resetFrame);removeEventListener("resize",onResize);removeEventListener("scroll",onResize,true);setRect(null)}
  },[active,current,pathname])

  useEffect(()=>{
    if(!active||!current)return
    const advanceTo=(target?:string)=>{
      if(typeof target!=="string"||!target||target.startsWith("__"))return
      const next=chapters.find(chapter=>chapter.key===target)
      if(!next||next.key===current.key)return
      const prior=progressRef.current
      const completed=unique([...prior.completed,current.key])
      write({...prior,activeKey:next.key,completed,paused:false,updatedAt:new Date().toISOString()})
      pendingPathRef.current=tourBaseRoute(role,next)
      router.push(tourRoute(role,next))
      setIndexOpen(false)
      setDetailsOpen(false)
    }
    const onTarget=(event:Event)=>{
      const detail=(event as CustomEvent<{target?:string}|string|undefined>).detail
      advanceTo(typeof detail==="string"?detail:detail?.target)
    }
    const onComplete=()=>{
      const prior=progressRef.current
      write({...prior,completed:unique([...prior.completed,current.key]),paused:false,updatedAt:new Date().toISOString()})
      sessionStorage.removeItem(TOUR_SESSION_KEY)
      dispatchEvent(new CustomEvent("uptilldawn-tour-finished",{detail:{role,mode}}))
    }
    addEventListener("uptilldawn-training-nav-target",onTarget)
    addEventListener("uptilldawn-training-completed",onComplete)
    return()=>{removeEventListener("uptilldawn-training-nav-target",onTarget);removeEventListener("uptilldawn-training-completed",onComplete)}
  },[active,chapters,current,mode,role,router,write])

  if(!active||!current||!chapters.length)return null

  const saveActive=(chapter:TourChapter,patch?:Partial<Progress>)=>{
    clearTrainingNavTarget()
    const next={...progressRef.current,...patch,activeKey:chapter.key,paused:false,updatedAt:new Date().toISOString()}
    pendingPathRef.current=tourBaseRoute(role,chapter)
    write(next);router.push(tourRoute(role,chapter));setIndexOpen(false);setDetailsOpen(false)
  }
  const skip=()=>{
    if(!targetMissing)return
    const skipped=unique([...progressRef.current.skipped,current.key])
    const next=chapters[currentIndex+1]
    if(next){saveActive(next,{skipped});return}
    write({...progressRef.current,skipped,paused:true,updatedAt:new Date().toISOString()})
    sessionStorage.removeItem(TOUR_SESSION_KEY)
    dispatchEvent(new CustomEvent("uptilldawn-tour-stop",{detail:{role,mode}}))
  }
  const pause=()=>{write({...progressRef.current,paused:true,updatedAt:new Date().toISOString()});sessionStorage.removeItem(TOUR_SESSION_KEY);dispatchEvent(new CustomEvent("uptilldawn-tour-stop",{detail:{role,mode}}))}
  const startScenario=(scenario:TourScenario)=>{
    seedScenario(scenario)
    const chapter=scenario==="pre_event"?chapters.find(item=>item.key==="events"):scenario==="live_event"||scenario==="break"?chapters.find(item=>item.key==="operations"):scenario==="post_event"?chapters.find(item=>item.key==="settings")||chapters.at(-1):chapters[0]
    if(chapter)saveActive(chapter)
  }
  const completedCount=chapters.filter(chapter=>progress.completed.includes(chapter.key)).length
  const percent=Math.round((completedCount/Math.max(1,chapters.length))*100)
  const isNew=current.newSince===TOUR_VERSION&&!progress.completed.includes(current.key)

  return <>
    {rect&&<>
      <div aria-hidden className="pointer-events-none fixed z-[188] animate-pulse rounded-xl border-[3px] border-violet-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.52),0_0_28px_rgba(139,92,246,0.95)] transition-all duration-300" style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}/>
      <div aria-hidden className="pointer-events-none fixed z-[189] -translate-x-1/2 rounded-full border-2 border-violet-300 bg-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-xl" style={{left:Math.min(window.innerWidth-62,Math.max(62,rect.left+rect.width/2)),top:Math.max(6,rect.top-38)}}>↓ {c(locale,"HIER","HERE","ICI","HIER")}</div>
    </>}
    <aside data-no-translate data-tour-panel style={tourPanelLayout(rect,window.innerHeight,window.innerWidth<1024)} className="overflow-y-auto fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-3 right-3 z-[190] mx-auto max-w-sm rounded-2xl border border-violet-500/50 bg-background/95 p-3 shadow-2xl backdrop-blur sm:left-auto sm:right-4 sm:bottom-4 sm:mx-0">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[.18em] text-violet-500">{c(locale,"Rondleiding","Tour","Visite","Rundgang")} · {currentIndex+1}/{chapters.length}</span>{isNew&&<span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[10px] font-black text-emerald-500">{c(locale,"NIEUW","NEW","NOUVEAU","NEU")}</span>}</div><h2 className="mt-1 truncate text-base font-black">{current.title[locale]}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{current.description[locale]}</p></div><button type="button" onClick={()=>setDetailsOpen(value=>!value)} aria-expanded={detailsOpen} aria-controls="tour-step-details" className="shrink-0 rounded-lg border px-3 py-2 text-xs font-black" aria-label={c(locale,"Uitleg","Explanation","Explication","Erklärung")}>{detailsOpen?"−":"?"}</button><button type="button" onClick={()=>setIndexOpen(value=>!value)} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-black">{indexOpen?c(locale,"SLUIT","CLOSE","FERMER","SCHLIESSEN"):c(locale,"INDEX","INDEX","INDEX","INDEX")}</button></div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-violet-500 transition-all" style={{width:percent+"%"}}/></div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{completedCount}/{chapters.length} {c(locale,"afgerond","completed","terminés","abgeschlossen")}</span><span>{percent}%</span></div>
      {targetReady?<div className="mt-3 rounded-xl border-2 border-violet-500/60 bg-violet-500/10 p-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-violet-500">{c(locale,"DOE DIT NU","DO THIS NOW","FAITES CECI MAINTENANT","JETZT AUSFÜHREN")}</p><p className="mt-1 text-sm font-bold">{c(locale,"Gebruik de knop of bediening die hierboven met HIER is aangeduid. Volg daarna de volgende gemarkeerde stap.","Use the button or control marked HERE above. Then follow the next highlighted step.","Utilisez le bouton ou la commande indiquée ICI ci-dessus. Suivez ensuite l’étape suivante mise en évidence.","Benutze die oben mit HIER markierte Schaltfläche oder Bedienung. Folge danach dem nächsten hervorgehobenen Schritt.")}</p></div>:<p className="mt-2 text-[11px] text-amber-500">{c(locale,"Trainingsonderdeel wordt geladen…","Loading training control…","Chargement de l’élément de formation…","Trainingselement wird geladen…")}</p>}
      {detailsOpen&&<div id="tour-step-details" className="mt-3 rounded-xl border p-3 text-xs leading-5"><p>{current.description[locale]}</p><p className="mt-2">{c(locale,"Voer de gemarkeerde actie uit op de pagina. Je voortgang wordt opgeslagen. Via STAPPEN kun je een onderdeel opnieuw openen; PAUZEER bewaart de rondleiding voor later.","Perform the highlighted action on the page. Your progress is saved. Use STEPS to reopen a chapter; PAUSE saves the tour for later.","Effectuez l’action indiquée sur la page. Votre progression est enregistrée. ÉTAPES permet de rouvrir un chapitre ; PAUSE conserve la visite pour plus tard.","Führe die markierte Aktion auf der Seite aus. Dein Fortschritt wird gespeichert. Mit SCHRITTE öffnest du ein Kapitel erneut; PAUSIEREN speichert den Rundgang für später.")}</p></div>}
      {targetMissing&&<div role="status" className="mt-3 rounded-xl border border-amber-500/40 p-3 text-xs"><p>{c(locale,"Deze bediening is nog niet beschikbaar. Je kunt wachten, via STAPPEN opnieuw openen of dit onderdeel overslaan.","This control is not available yet. Wait, reopen it through STEPS, or skip this chapter.","Cette commande n’est pas encore disponible. Attendez, rouvrez-la via ÉTAPES ou passez ce chapitre.","Diese Bedienung ist noch nicht verfügbar. Warte, öffne sie über SCHRITTE erneut oder überspringe dieses Kapitel.")}</p><button type="button" onClick={skip} className="mt-2 rounded-lg border px-3 py-2 font-bold">{c(locale,"OVERSLAAN","SKIP","PASSER","ÜBERSPRINGEN")}</button></div>}
      {indexOpen&&<div className="mt-3 max-h-[44dvh] space-y-3 overflow-y-auto rounded-xl border p-3">
        <div className="grid grid-cols-2 gap-2">{(["pre_event","live_event","break","post_event"] as TourScenario[]).map(scenario=><button key={scenario} type="button" onClick={()=>startScenario(scenario)} className="rounded-lg border p-2 text-left text-xs font-bold">{scenario==="pre_event"?c(locale,"Vóór event","Before event","Avant événement","Vor Event"):scenario==="live_event"?c(locale,"Lopend event","Live event","Événement actif","Aktives Event"):scenario==="break"?c(locale,"Pauze","Break","Pause","Pause"):c(locale,"Na event","After event","Après événement","Nach Event")}</button>)}</div>
        <div className="space-y-1">{chapters.map((chapter,i)=>{const done=progress.completed.includes(chapter.key),skipped=progress.skipped.includes(chapter.key),fresh=chapter.newSince===TOUR_VERSION&&!done;return <button key={chapter.key} type="button" onClick={()=>saveActive(chapter)} className={"flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs "+(chapter.key===current.key?"border-violet-500 bg-violet-500/10":"")}><span className="w-5 text-center font-black">{done?"✓":skipped?"–":i+1}</span><span className="min-w-0 flex-1 truncate font-semibold">{chapter.title[locale]}</span>{fresh&&<span className="text-[9px] font-black text-emerald-500">{c(locale,"NIEUW","NEW","NOUVEAU","NEU")}</span>}</button>})}</div>
        <p className="text-[11px] leading-5 text-muted-foreground">{c(locale,"Training gebruikt uitsluitend fictieve sandboxgegevens. Push-, locatie-, camera- en selfiepermissies worden hier nooit echt aangevraagd; de productie-app vraagt ze pas vlak vóór de functie ze nodig heeft.","Training uses fictional sandbox data only. Push, location, camera and selfie permissions are never requested for real here; production asks only immediately before a feature needs them.","La formation utilise uniquement des données fictives du sandbox. Les autorisations push, localisation, caméra et selfie ne sont jamais réellement demandées ici ; la production les demande juste avant leur utilisation.","Das Training verwendet ausschließlich fiktive Sandboxdaten. Push-, Standort-, Kamera- und Selfie-Berechtigungen werden hier nie real angefordert; die Produktion fragt sie erst unmittelbar vor der Nutzung an.")}</p>
      </div>}
      <div className="mt-3 flex items-center gap-2"><button type="button" onClick={()=>setIndexOpen(value=>!value)} className="rounded-lg border px-3 py-2 text-xs font-bold">{c(locale,"STAPPEN","STEPS","ÉTAPES","SCHRITTE")}</button><button type="button" onClick={pause} className="rounded-lg border px-3 py-2 text-xs font-bold">{c(locale,"PAUZEER","PAUSE","PAUSE","PAUSIEREN")}</button><span className="ml-auto text-[11px] font-semibold text-violet-500">{targetReady?c(locale,"Voer de gemarkeerde actie uit","Perform the highlighted action","Effectuez l’action indiquée","Führe die markierte Aktion aus"):c(locale,"Even laden…","Loading…","Chargement…","Laden…")}</span></div>
    </aside>
  </>
}
