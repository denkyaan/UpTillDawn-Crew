"use client"

import {useCallback,useEffect,useMemo,useRef,useState} from "react"
import {usePathname,useRouter} from "next/navigation"
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
  const tourScope:"general"|"workplace"=preferredWorkplace?"workplace":"general"
  const chapters=useMemo(()=>getTourChapters(role,{driver,entrance,mode,scope:tourScope}),[driver,entrance,mode,role,tourScope])
  const progressKey=tourProgressKey(userId,role,preferredWorkplace)
  // Keep SSR and the first browser render identical. Locale and saved tour
  // progress are restored only after mount, preventing React hydration errors.
  const [locale,setLocale]=useState<SupportedUiLocale>("nl")
  const [progress,setProgress]=useState<Progress>(()=>initialProgress(chapters[0]?.key||"overview"))
  const [rect,setRect]=useState<Rect|null>(null)
  const [targetMissing,setTargetMissing]=useState(false)
  const [actionFeedback,setActionFeedback]=useState("")
  const [navigationTarget,setNavigationTarget]=useState<string|null>(null)
  const pendingPathRef=useRef<string|null>(null)
  const awaitingNavigationRef=useRef<string|null>(null)
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
    let state:Record<string,unknown>={}
    try{state=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}")}catch{}
    const finalReady=current.key==="timesheet"&&chapters.slice(0,-1).every(chapter=>progress.completed.includes(chapter.key))
    sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify({...state,finalTimesheetReady:finalReady}))
  },[active,chapters,current,progress.completed])
  useEffect(()=>{
    if(!active||!current)return
    const expected=tourBaseRoute(role,current)
    if(pendingPathRef.current){
      if(pathname!==pendingPathRef.current)return
      pendingPathRef.current=null
    }
    if(pathname!==expected){
      const awaited=awaitingNavigationRef.current
      const awaitedChapter=chapters.find(item=>item.key===awaited)
      if(awaitedChapter&&pathname===tourBaseRoute(role,awaitedChapter)){
        const prior=progressRef.current
        write({...prior,activeKey:awaitedChapter.key,completed:unique([...prior.completed,current.key]),paused:false,updatedAt:new Date().toISOString()})
        awaitingNavigationRef.current=null
        setNavigationTarget(null)
        return
      }
      const routeChapter=chapterForPath(role,pathname,chapters)
      if(routeChapter&&tourBaseRoute(role,current)!==pathname){
        // Navigation is not proof of completing the previous action.
        router.push(tourRoute(role,current))
      }else router.push(tourRoute(role,current))
    }
  },[active,chapters,current,pathname,role,router,write])

  useEffect(()=>{
    if(!active||!current)return
    let stopped=false
    let observer:MutationObserver|undefined
    let resizeObserver:ResizeObserver|undefined
    let observedTarget:HTMLElement|undefined
    let observedLayoutRoot:Element|undefined
    let timeout=0
    let frame=0
    let located=false
    const resetFrame=requestAnimationFrame(()=>{setTargetMissing(false)})
    // Select the tour target from the actual viewport width. CI and embedded/PWA
    // environments can report a stale media-query result during the first paint,
    // which previously made tablet bots resolve the desktop container while the
    // visible primary action belonged to the mobile layout.
    const mobile=innerWidth<1024
    const selector=mobile?current.mobileSelector:current.desktopSelector
    if(navigationTarget){setRect(null);return}
    const updateRect=(element:Element)=>{
      const target=element as HTMLElement
      cancelAnimationFrame(frame)
      if(!located)target.scrollIntoView({behavior:"auto",block:"center",inline:"nearest"})
      // Translated labels and responsive containers can shift the target without
      // changing its size. Sample the live DOM on consecutive animation frames
      // instead of relying solely on ResizeObserver and mutation notifications.
      const sample=()=>{
        if(stopped)return
        const r=target.getBoundingClientRect()
        setRect(previous=>{
          const next={left:Math.max(4,r.left-5),top:Math.max(4,r.top-5),width:Math.max(24,r.width+10),height:Math.max(24,r.height+10)}
          return previous&&previous.left===next.left&&previous.top===next.top&&previous.width===next.width&&previous.height===next.height?previous:next
        })
        frame=requestAnimationFrame(sample)
      }
      frame=requestAnimationFrame(sample)
    }
    const rectEdges=(r:DOMRect)=>({
      right:Number.isFinite(r.right)?r.right:r.left+r.width,
      bottom:Number.isFinite(r.bottom)?r.bottom:r.top+r.height,
    })
    const visibleInViewport=(element:Element|null):element is HTMLElement=>{
      if(!(element instanceof HTMLElement))return false
      const style=getComputedStyle(element)
      if(style.display==="none"||style.visibility==="hidden"||!element.getClientRects().length)return false
      const r=element.getBoundingClientRect(),edges=rectEdges(r)
      return r.width>0&&r.height>0&&edges.bottom>0&&edges.right>0&&r.top<innerHeight&&r.left<innerWidth
    }
    const viewportScore=(element:HTMLElement)=>{
      const r=element.getBoundingClientRect(),edges=rectEdges(r)
      const width=Math.max(0,Math.min(edges.right,innerWidth)-Math.max(r.left,0))
      const height=Math.max(0,Math.min(edges.bottom,innerHeight)-Math.max(r.top,0))
      return width*height
    }
    const locate=()=>{
      const containers=typeof document.querySelectorAll==="function"?[...document.querySelectorAll(selector)]:(()=>{const container=document.querySelector(selector);return container?[container]:[]})()
      const candidates=containers.flatMap(container=>{
        const exactPrimary=container instanceof HTMLElement&&container.matches('[data-tour-demo="primary-action"]:not(:disabled)')?container:null
        const nestedPrimary=container?.querySelector('[data-tour-demo="primary-action"]:not(:disabled)')
        const fallbackAction=container?.querySelector('button:not(:disabled), summary, input:not(:disabled)')
        const found=exactPrimary||nestedPrimary||fallbackAction||container
        return visibleInViewport(found)?[found]:[]
      }).sort((a,b)=>{
        const score=viewportScore(b)-viewportScore(a)
        if(score)return score
        const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect()
        return ar.top-br.top||ar.left-br.left
      })
      const found=candidates[0]
      if(found){
        cancelAnimationFrame(resetFrame);setTargetMissing(false);updateRect(found);located=true
        const layoutRoot=found.closest('[data-tour-demo="training-screen"]')||found.parentElement||found
        if(observedTarget!==found||observedLayoutRoot!==layoutRoot){
          observedTarget=found;observedLayoutRoot=layoutRoot
          resizeObserver?.disconnect()
          resizeObserver=new ResizeObserver(()=>updateRect(found))
          resizeObserver.observe(found)
          if(layoutRoot!==found)resizeObserver.observe(layoutRoot)
          observer?.disconnect()
          observer=new MutationObserver(()=>{locate()})
          observer.observe(layoutRoot,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","style","hidden"]})
        }
        return true
      }
      return false
    }
    if(!locate()){
      observer=new MutationObserver(()=>{locate()})
      observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","style","hidden"]})
      timeout=window.setTimeout(()=>{if(stopped||locate())return;setTargetMissing(true);setRect(null);void reportMissingTarget(current,selector)},8000)
    }
    const onResize=()=>{locate()}
    addEventListener("resize",onResize)
    addEventListener("scroll",onResize,true)
    return()=>{stopped=true;observer?.disconnect();resizeObserver?.disconnect();window.clearTimeout(timeout);cancelAnimationFrame(frame);cancelAnimationFrame(resetFrame);removeEventListener("resize",onResize);removeEventListener("scroll",onResize,true);setRect(null)}
  },[active,current,locale,pathname,navigationTarget])

  useEffect(()=>{
    if(!active||!current)return
    const advanceTo=(target?:string)=>{
      if(typeof target!=="string"||!target||target.startsWith("__"))return
      // A sandbox action can emit an operational target (for example "events")
      // while the active first-use tour is intentionally scoped to general
      // chapters only. In that case continue to the next chapter in the active
      // scope instead of silently ignoring the user's indicated action.
      const requested=chapters.find(chapter=>chapter.key===target)
      // Do not allow an arbitrary event to skip chapters.
      const next=chapters[currentIndex+1]
      if(!requested||requested.key!==next?.key)return
      if(!next||next.key===current.key)return
      // Unlock the next chapter only after the trainee opens its tab.
      awaitingNavigationRef.current=next.key
      setNavigationTarget(tourBaseRoute(role,next))
      setActionFeedback(c(locale,"Open nu zelf de volgende tab.","Open the next tab yourself.","Ouvrez vous-même l’onglet suivant.","Öffne den nächsten Tab selbst."))
    }
    const onTarget=(event:Event)=>{
      setActionFeedback(current.description[locale])
      window.setTimeout(()=>setActionFeedback(""),2600)
      const detail=(event as CustomEvent<{target?:string}|string|undefined>).detail
      advanceTo(typeof detail==="string"?detail:detail?.target)
    }
    const onComplete=()=>{
      // Completion requires the sandbox to have recorded a submitted timesheet.
      let submitted=false
      try{submitted=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}").operationPhase==="timesheet"}catch{}
      if(!submitted||current.key!==chapters[chapters.length-1]?.key||chapters.some(chapter=>chapter.key!==current.key&&!progressRef.current.completed.includes(chapter.key)))return
      const prior=progressRef.current
      write({...prior,completed:unique([...prior.completed,current.key]),paused:false,updatedAt:new Date().toISOString()})
      sessionStorage.removeItem(TOUR_SESSION_KEY)
      dispatchEvent(new CustomEvent("uptilldawn-tour-finished",{detail:{role,mode,workplace:preferredWorkplace}}))
    }
    addEventListener("uptilldawn-training-nav-target",onTarget)
    addEventListener("uptilldawn-training-completed",onComplete)
    return()=>{removeEventListener("uptilldawn-training-nav-target",onTarget);removeEventListener("uptilldawn-training-completed",onComplete)}
  },[active,chapters,current,currentIndex,locale,mode,preferredWorkplace,role,router,write])

  if(!active||!current||!chapters.length)return null

  const pause=()=>{write({...progressRef.current,paused:true,updatedAt:new Date().toISOString()});sessionStorage.removeItem(TOUR_SESSION_KEY);dispatchEvent(new CustomEvent("uptilldawn-tour-stop",{detail:{role,mode}}))}

  return <>
    {navigationTarget&&<style>{`a[href^="${navigationTarget}"]{outline:3px solid #8b5cf6!important;outline-offset:2px!important;border-radius:10px}`}</style>}
    {!navigationTarget&&<style>{`[data-tour-demo="primary-action"]:not(:disabled){background-color:#7c3aed!important;color:white!important;border-color:#7c3aed!important;animation:none!important}`}</style>}
    {rect&&<>
      <div aria-hidden className="pointer-events-none fixed z-[188] rounded-xl bg-violet-600/20 outline outline-2 outline-violet-500" style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}/>
    </>}
    {actionFeedback&&<div data-no-translate className="pointer-events-none fixed left-1/2 top-20 z-[190] w-[min(88vw,22rem)] -translate-x-1/2 rounded-xl border border-violet-500/50 bg-background/95 px-3 py-2 text-xs font-semibold leading-5 shadow-xl backdrop-blur">{actionFeedback}</div>}
    <div data-no-translate data-tour-panel className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[190] flex items-center gap-2">
      <span className="rounded-full border border-violet-500/50 bg-background/95 px-2.5 py-1.5 text-[10px] font-black shadow">{currentIndex+1}/{chapters.length}</span>
      {targetMissing&&<span role="status" className="rounded-full border border-amber-500/50 bg-background/95 px-3 py-1.5 text-[10px] font-bold">{c(locale,"DOEL ONTBREEKT — TRAINING GEBLOKKEERD","TARGET MISSING — TRAINING BLOCKED","CIBLE ABSENTE — FORMATION BLOQUÉE","ZIEL FEHLT — TRAINING BLOCKIERT")}</span>}
      <button type="button" onClick={pause} className="pointer-events-auto rounded-full border bg-background/95 px-3 py-1.5 text-[10px] font-black">{c(locale,"PAUZEER","PAUSE","PAUSE","PAUSIEREN")}</button>
    </div>
  </>
}
