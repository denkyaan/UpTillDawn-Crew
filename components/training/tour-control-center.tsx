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

function initialProgress(defaultKey:string):Progress{
  return {version:TOUR_VERSION,activeKey:defaultKey,completed:[],skipped:[],paused:false,updatedAt:""}
}

function readProgress(key:string,defaultKey:string):Progress{
  const fallback=initialProgress(defaultKey)
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
  const tourScope=preferredWorkplace?"workplace":"general" as const\n  const chapters=useMemo(()=>getTourChapters(role,{driver,entrance,mode,scope:tourScope}),[driver,entrance,mode,role,tourScope])
  const progressKey=tourProgressKey(userId,role,preferredWorkplace)
  // Keep SSR and the first browser render identical. Locale and saved tour
  // progress are restored only after mount, preventing React hydration errors.
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  const [progress,setProgress]=useState<Progress>(()=>initialProgress(chapters[0]?.key||"overview"))
  const [indexOpen,setIndexOpen]=useState(false)
  const [detailsOpen,setDetailsOpen]=useState(false)
  const [rect,setRect]=useState<Rect|null>(null)
  const [targetReady,setTargetReady]=useState(false)
  const [targetMissing,setTargetMissing]=useState(false)
  const [actionFeedback,setActionFeedback]=useState("")
  const pendingPathRef=useRef<string|null>(null)
  const progressRef=useRef(progress)
  useEffect(()=>{progressRef.current=progress},[progress])
  const write=useCallback((next:Progress)=>{progressRef.current=next;setProgress(next);localStorage.setItem(progressKey,JSON.stringify(next))},[progressKey])

  useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
  useEffect(()=>{
    if(!active||!chapters.length)return
    sessionStorage.setItem(TOUR_SESSION_KEY,JSON.stringify({active:true,role,mode,workplace:preferredWorkplace}))
    const restored=readProgress(progressKey,chapters[0].key)
    const chapter=chapters.find(item=>item.key===restored.activeKey)||chapters[0]
    const next={...restored,activeKey:chapter.key}
    pendingPathRef.current=tourBaseRoute(role,chapter)
    router.push(tourRoute(role,chapter))
    const frame=requestAnimationFrame(()=>{
      write({...next,paused:false,updatedAt:new Date().toISOString()})
    })
    return()=>cancelAnimationFrame(frame)
  },[active,chapters,mode,preferredWorkplace,progressKey,role,router,write])

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
    let resizeObserver:ResizeObserver|undefined
    let timeout=0
    let frame=0
    let located=false
    const resetFrame=requestAnimationFrame(()=>{setTargetMissing(false)})
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
      const exactPrimary=container instanceof HTMLElement&&container.matches('[data-tour-demo="primary-action"]:not(:disabled)')?container:null
      const nestedPrimary=container?.querySelector('[data-tour-demo="primary-action"]:not(:disabled)')
      const fallbackAction=container?.querySelector('button:not(:disabled), summary, input:not(:disabled)')
      const found=exactPrimary||nestedPrimary||fallbackAction||container
      if(found){
        const style=getComputedStyle(found)
        if(style.display!=="none"&&style.visibility!=="hidden"&&found.getClientRects().length){
          cancelAnimationFrame(resetFrame);setTargetMissing(false);updateRect(found);located=true
          resizeObserver?.disconnect();resizeObserver=new ResizeObserver(()=>updateRect(found));resizeObserver.observe(found)
          return true
        }
      }
      return false
    }
    if(!locate()){
      observer=new MutationObserver(()=>{if(locate())observer?.disconnect()})
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style","hidden"]})
      timeout=window.setTimeout(()=>{if(stopped||locate())return;setTargetMissing(true);setRect(null);void reportMissingTarget(current,selector)},8000)
    }
    const onResize=()=>{locate()}
    addEventListener("resize",onResize)
    addEventListener("scroll",onResize,true)
    return()=>{stopped=true;observer?.disconnect();resizeObserver?.disconnect();window.clearTimeout(timeout);cancelAnimationFrame(frame);cancelAnimationFrame(resetFrame);removeEventListener("resize",onResize);removeEventListener("scroll",onResize,true);setRect(null)}
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
      dispatchEvent(new CustomEvent("uptilldawn-tour-finished",{detail:{role,mode,workplace:preferredWorkplace}}))
    }
    addEventListener("uptilldawn-training-nav-target",onTarget)
    addEventListener("uptilldawn-training-completed",onComplete)
    return()=>{removeEventListener("uptilldawn-training-nav-target",onTarget);removeEventListener("uptilldawn-training-completed",onComplete)}
  },[active,chapters,current,locale,mode,preferredWorkplace,role,router,write])

  if(!active||!current||!chapters.length)return null

  const saveActive=(chapter:TourChapter,patch?:Partial<Progress>)=>{
    clearTrainingNavTarget()
    const next={...progressRef.current,...patch,activeKey:chapter.key,paused:false,updatedAt:new Date().toISOString()}
    pendingPathRef.current=tourBaseRoute(role,chapter)
    write(next);router.push(tourRoute(role,chapter))
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
    {actionFeedback&&<div data-no-translate className="pointer-events-none fixed left-1/2 top-20 z-[190] w-[min(88vw,22rem)] -translate-x-1/2 rounded-xl border border-violet-500/50 bg-background/95 px-3 py-2 text-xs font-semibold leading-5 shadow-xl backdrop-blur">{actionFeedback}</div>}
    <div data-no-translate data-tour-panel className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[190] flex items-center gap-2">
      <span className="rounded-full border border-violet-500/50 bg-background/95 px-2.5 py-1.5 text-[10px] font-black shadow">{currentIndex+1}/{chapters.length}</span>
      {targetMissing&&<button type="button" onClick={skip} className="pointer-events-auto rounded-full border bg-background/95 px-3 py-1.5 text-[10px] font-black">{c(locale,"OVERSLAAN","SKIP","PASSER","ÜBERSPRINGEN")}</button>}
      <button type="button" onClick={pause} className="pointer-events-auto rounded-full border bg-background/95 px-3 py-1.5 text-[10px] font-black">{c(locale,"PAUZEER","PAUSE","PAUSE","PAUSIEREN")}</button>
    </div>
  </>
}
