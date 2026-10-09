"use client"

import {useCallback,useEffect,useMemo,useRef,useState} from "react"
import {usePathname,useRouter} from "next/navigation"
import {createPortal} from "react-dom"
import {RoleTrainingLab} from "@/components/training/role-training-lab"
import {isChapterPractised} from "@/lib/training-exercise-catalog"
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
// Sandbox components emit their own completion destination. Role-specific
// chapter order can differ, so validate the source action and unlock only the
// next chapter in the actual role sequence, never an arbitrary skipped chapter.
const ACTION_TARGETS:Record<string,readonly string[]>={
  overview:["events","personnel"],events:["workplaces"],workplaces:["briefings"],
  briefings:["operations"],operations:["tasks"],driver:["tasks"],
  tasks:["incidents"],incidents:["inventory"],inventory:["guestlist"],
  guestlist:["sales","crew"],sales:["personnel"],personnel:["crew"],
  crew:["chat"],chat:["settings","exports"],exports:["platform"],
  platform:["settings"],settings:["timesheet"],
}


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
  const [,setRect]=useState<Rect|null>(null)
  const [targetMissing,setTargetMissing]=useState(false)
  const [actionFeedback,setActionFeedback]=useState("")
  const [navigationTarget,setNavigationTarget]=useState<string|null>(null)
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null)
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
    // Stored chapter flags from the old tour are NOT proof that the user
    // performed the new hands-on actions. Reject every unverified flag and
    // resume from the first incomplete chapter rather than skipping ahead.
    const verified=chapters.filter(item=>restored.completed.includes(item.key)&&isChapterPractised(progressKey,role,item.key)).map(item=>item.key)
    const chapter=chapters.find(item=>!verified.includes(item.key))||chapters[chapters.length-1]
    const next={...restored,activeKey:chapter.key,completed:verified,skipped:[]}
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
      if(awaitedChapter&&pathname===tourBaseRoute(role,awaitedChapter)&&isChapterPractised(progressKey,role,current.key)){
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
  },[active,chapters,current,pathname,progressKey,role,router,write])

  useEffect(()=>{
    if(!active||!current||navigationTarget)return
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
    const moveToNext=()=>{
      if(!isChapterPractised(progressKey,role,current.key))return
      const next=chapters[currentIndex+1]
      if(!next||next.key===current.key)return
      const prior=progressRef.current
      // Multiple exercises can be on the same route (operations and Driver).
      // This is a scenario change, not navigation to another tab.
      if(tourBaseRoute(role,current)===tourBaseRoute(role,next)){
        write({...prior,activeKey:next.key,completed:unique([...prior.completed,current.key]),paused:false,updatedAt:new Date().toISOString()})
        return
      }
      awaitingNavigationRef.current=next.key
      setNavigationTarget(tourBaseRoute(role,next))
      try{
        const state=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}")
        sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify({...state,navTarget:next.key}))
      }catch{}
      dispatchEvent(new CustomEvent("uptilldawn-training-next-tab",{detail:{target:next.key}}))
      setActionFeedback(c(locale,"Open nu zelf de volgende tab.","Open the next tab yourself.","Ouvrez vous-même l’onglet suivant.","Öffne den nächsten Tab selbst."))
    }
    const onTarget=(event:Event)=>{
      const detail=(event as CustomEvent<{target?:string}|string|undefined>).detail
      const target=typeof detail==="string"?detail:detail?.target
      if(!target)return
      setActionFeedback(current.description[locale])
      window.setTimeout(()=>setActionFeedback(""),2600)
      if(!ACTION_TARGETS[current.key]?.includes(target))return
      // Legacy sandbox buttons remain illustrative, but cannot unlock the
      // course until every required, independently recorded practice action
      // for this chapter has been completed by the trainee.
      if(!isChapterPractised(progressKey,role,current.key)){
        try{
          const state=JSON.parse(sessionStorage.getItem(TOUR_WORKFLOW_KEY)||"{}")
          sessionStorage.setItem(TOUR_WORKFLOW_KEY,JSON.stringify({...state,navTarget:null}))
        }catch{}
        dispatchEvent(new CustomEvent("uptilldawn-training-next-tab",{detail:{target:null}}))
        return
      }
      moveToNext()
    }
    const onLabCompleted=(event:Event)=>{
      const detail=(event as CustomEvent<{role?:TourRole;chapter?:string}>).detail
      if(detail?.role!==role||detail.chapter!==current.key)return
      if(!isChapterPractised(progressKey,role,current.key))return
      if(current.key===chapters[chapters.length-1]?.key){
        if(chapters.some(chapter=>chapter.key!==current.key&&!progressRef.current.completed.includes(chapter.key)))return
        const prior=progressRef.current
        write({...prior,completed:unique([...prior.completed,current.key]),paused:false,updatedAt:new Date().toISOString()})
        sessionStorage.removeItem(TOUR_SESSION_KEY)
        dispatchEvent(new CustomEvent("uptilldawn-tour-finished",{detail:{role,mode,workplace:preferredWorkplace}}))
        return
      }
      moveToNext()
    }
    addEventListener("uptilldawn-training-nav-target",onTarget)
    addEventListener("uptilldawn-training-lab-completed",onLabCompleted)
    return()=>{
      removeEventListener("uptilldawn-training-nav-target",onTarget)
      removeEventListener("uptilldawn-training-lab-completed",onLabCompleted)
    }
  },[active,chapters,current,currentIndex,locale,mode,preferredWorkplace,progressKey,role,write])

  // Mount the practical exercises directly in each fictional page, not as a
  // full-screen overlay. The existing fake data remains visible and editable.
  useEffect(()=>{
    if(!active||!current||typeof document.createElement!=="function")return
    let host:HTMLDivElement|null=null
    let stopped=false
    const mount=()=>{
      if(stopped||host)return
      const root=document.querySelector('[data-tour-demo="training-screen"]')||document.querySelector("main")
      if(!(root instanceof HTMLElement))return
      host=document.createElement("div")
      host.setAttribute("data-training-lab-host",current.key)
      root.appendChild(host)
      setPortalHost(host)
    }
    const frame=requestAnimationFrame(mount)
    const observer=new MutationObserver(mount)
    observer.observe(document.body,{childList:true,subtree:true})
    return()=>{
      stopped=true
      observer.disconnect()
      cancelAnimationFrame(frame)
      host?.remove()
    }
  },[active,current,pathname])

  // Only the target tab is accented during navigation. Sandbox actions use
  // a solid purple control; no page-dimming overlay or blinking highlight.
  useEffect(()=>{
    if(!active)return
    document.body.dataset.uptTrainingActive="true"
    return()=>{delete document.body.dataset.uptTrainingActive}
  },[active])

  useEffect(()=>{
    if(!active||!navigationTarget)return
    const sync=()=>{
      for(const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]")){
        const path=anchor.getAttribute("href")?.split(/[?#]/)[0]
        if(path===navigationTarget)anchor.setAttribute("data-upt-training-next-tab","true")
        else anchor.removeAttribute("data-upt-training-next-tab")
      }
    }
    sync()
    const observer=new MutationObserver(sync)
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["href"]})
    return()=>{
      observer.disconnect()
      document.querySelectorAll('[data-upt-training-next-tab]').forEach(anchor=>anchor.removeAttribute("data-upt-training-next-tab"))
    }
  },[active,navigationTarget])

  if(!active||!current||!chapters.length)return null

  const pause=()=>{write({...progressRef.current,paused:true,updatedAt:new Date().toISOString()});sessionStorage.removeItem(TOUR_SESSION_KEY);dispatchEvent(new CustomEvent("uptilldawn-tour-stop",{detail:{role,mode}}))}

  return <>
    {portalHost&&createPortal(<RoleTrainingLab key={progressKey+":"+current.key} role={role} chapter={current.key} progressKey={progressKey}/>,portalHost)}
    {actionFeedback&&<div data-no-translate className="pointer-events-none fixed left-1/2 top-20 z-[190] w-[min(88vw,22rem)] -translate-x-1/2 rounded-xl border border-violet-500/50 bg-background/95 px-3 py-2 text-xs font-semibold leading-5 shadow-xl backdrop-blur">{actionFeedback}</div>}
    <div data-no-translate data-tour-panel className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+.75rem)] z-[190] flex items-center gap-2">
      <span className="rounded-full border border-violet-500/50 bg-background/95 px-2.5 py-1.5 text-[10px] font-black shadow">{currentIndex+1}/{chapters.length}</span>
      {targetMissing&&<span role="status" className="rounded-full border border-amber-500/50 bg-background/95 px-3 py-1.5 text-[10px] font-bold">{c(locale,"DOEL ONTBREEKT — TRAINING GEBLOKKEERD","TARGET MISSING — TRAINING BLOCKED","CIBLE ABSENTE — FORMATION BLOQUÉE","ZIEL FEHLT — TRAINING BLOCKIERT")}</span>}
      <button type="button" onClick={pause} className="pointer-events-auto rounded-full border bg-background/95 px-3 py-1.5 text-[10px] font-black">{c(locale,"PAUZEER","PAUSE","PAUSE","PAUSIEREN")}</button>
    </div>
  </>
}
