"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronUp } from "lucide-react"
import { NAV_ITEMS, type NavigationItem } from "@/components/layout/navigation-items"
import { useAuth } from "@/lib/providers"
import { cn } from "@/lib/utils"
import { getDefaultRoleUiLabel, type RoleRuleRole } from "@/lib/role-ui"
import { featureHelp } from "@/lib/ui-field-help"
import { useAdminSelection } from "@/lib/admin-selection-context"
import { LANGUAGE_APPLIED_EVENT, activeUiLocale, type SupportedUiLocale } from "@/lib/locale-preferences"

const ASSIGNED_EVENT_KEYS=["events","briefings","workplaces"] as const
const STAFF_ACTIVE_SHIFT_KEYS=["operations","workplaces","briefings","tasks"] as const
const RESPONSIBLE_ACTIVE_SHIFT_KEYS=["operations","workplaces","incidents"] as const
const RESPONSIBLE_ASSIGNED_EVENT_KEYS=["events","briefings","workplaces","inventory"] as const

export function MobileBottomNav({
  chatMissed=0,
  incidentMissed=0,
  taskMissed=0,
  notificationFeatureCounts={},
  featureOrder=[],
  featureLabels={},
  featureVisibility={},
  assignedEvent=false,
  shiftActive=false,
}:{
  chatMissed?:number
  incidentMissed?:number
  taskMissed?:number
  notificationFeatureCounts?:Record<string,number>
  featureOrder?:string[]
  featureLabels?:Record<string,string>
  featureVisibility?:Record<string,boolean>
  assignedEvent?:boolean
  shiftActive?:boolean
}) {
 const pathname=usePathname()
 const [expanded,setExpanded]=useState(false)
 const [tourPreview,setTourPreview]=useState(false)
 const [sandboxHelp,setSandboxHelp]=useState("")
 const [trainingNavTarget,setTrainingNavTarget]=useState<string|null>(null)
 const [trainingLocale,setTrainingLocale]=useState<SupportedUiLocale>(()=>typeof window==="undefined"?"nl":activeUiLocale())
 const {roles,isAdmin}=useAuth()
 const adminContext=useAdminSelection()
 const roleKey:RoleRuleRole=roles.includes("admin")?"admin":roles.includes("responsible_lead")?"responsible_lead":"staff"
 const order=new Map(featureOrder.map((key,index)=>[key,index]))
 useEffect(()=>{const on=(e:Event)=>{const detail=(e as CustomEvent<{active?:boolean}>).detail;const active=Boolean(detail?.active);setTourPreview(active);if(!active)setExpanded(false)};addEventListener("uptilldawn-tour-preview",on);return()=>removeEventListener("uptilldawn-tour-preview",on)},[])
 useEffect(()=>{const load=()=>{try{const s=JSON.parse(sessionStorage.getItem("uptilldawn-training-workflow-v3")||"{}");setTrainingNavTarget(s.navTarget||null)}catch{setTrainingNavTarget(null)}};const id=requestAnimationFrame(load);return()=>cancelAnimationFrame(id)},[pathname])
 useEffect(()=>{const on=(e:Event)=>setTrainingNavTarget((e as CustomEvent<{target?:string}>).detail?.target||null);addEventListener("uptilldawn-training-nav-target",on);return()=>removeEventListener("uptilldawn-training-nav-target",on)},[])
 useEffect(()=>{const apply=()=>setTrainingLocale(activeUiLocale());addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])

 // During the guided tour expose the complete role navigation regardless of
 // event/shift assignment. This is preview-only; backend permissions remain unchanged.
 const items=NAV_ITEMS.filter(i=>{
   if(!roles.some(r=>i.roles.includes(r))) return false
   if(i.key==="shifts") return false
   if(!tourPreview&&Object.prototype.hasOwnProperty.call(featureVisibility,i.key)&&!featureVisibility[i.key]) return false
   return true
 }).sort((a,b)=>(order.get(a.key)??999)-(order.get(b.key)??999))

 const hrefFor=(item:NavigationItem)=>{
   const base=item.href==='/'&&isAdmin?'/admin':item.href
   const href=isAdmin?adminContext.href(base):base
   if(!tourPreview)return href
   const join=href.includes("?")?"&":"?"
   return href+join+"tour=1"
 }
 const isActive=(item:NavigationItem)=>{
   const href=hrefFor(item)
   return href==='/'?pathname==='/':pathname.startsWith(href)
 }

 const contextualKeys=tourPreview?[]:roleKey==="staff"
   ? shiftActive
     ? STAFF_ACTIVE_SHIFT_KEYS
     : assignedEvent
       ? ASSIGNED_EVENT_KEYS
       : []
   : roleKey==="responsible_lead"
     ? shiftActive
       ? RESPONSIBLE_ACTIVE_SHIFT_KEYS
       : assignedEvent
         ? RESPONSIBLE_ASSIGNED_EVENT_KEYS
         : []
     : []

 const contextualItems=contextualKeys
   .map(key=>items.find(item=>item.key===key))
   .filter((item):item is NavigationItem=>Boolean(item))

 const activeIndex=items.findIndex(isActive)
 const fallbackItems=items.length<=3
   ? items
   : activeIndex<=0
     ? items.slice(0,3)
     : activeIndex>=items.length-1
       ? items.slice(-3)
       : items.slice(activeIndex-1,activeIndex+2)
 const compactItems=contextualItems.length?contextualItems:fallbackItems

 const badgeCount=(key:string)=>{
   const activityCount=key==="chat"?chatMissed:key==="incidents"?incidentMissed:key==="tasks"?taskMissed:0
   return Math.max(activityCount,notificationFeatureCounts[key]??0)
 }

 const NavItem=({item,expandedItem=false}:{item:NavigationItem;expandedItem?:boolean})=>{
   const href=hrefFor(item)
   const active=isActive(item)
   const Icon=item.icon
   const count=badgeCount(item.key)
   const label=featureLabels[item.key] || getDefaultRoleUiLabel(roleKey,item.key,item.label)
   const help=featureHelp(item.key,label)
   return <Link
    data-layout-key={item.key}
    href={href}
    title={help.description}
    aria-description={help.description}
    onClick={()=>{
      if(tourPreview&&item.key==="workplaces"){try{const s=JSON.parse(sessionStorage.getItem("uptilldawn-training-workflow-v3")||"{}");sessionStorage.setItem("uptilldawn-training-workflow-v3",JSON.stringify({...s,navTarget:null}))}catch{};setTrainingNavTarget(null)}
      setExpanded(false)
      if(tourPreview){
        const message=help.description
        sessionStorage.setItem("uptilldawn-sandbox-help",message)
        setSandboxHelp(message)
        dispatchEvent(new CustomEvent("uptilldawn-sandbox-help",{detail:message}))
      }
    }}
    className={cn(
      expandedItem
        ?"flex min-h-16 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold"
        :"flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[9px] font-semibold",
      active?"bg-violet-500/10 text-violet-400":"text-muted-foreground",
      trainingNavTarget===item.key?"ring-4 ring-violet-500 ring-inset animate-pulse":"",
    )}
   >
    <span className="relative shrink-0">
     <Icon className="h-5 w-5"/>
     {count>0&&<span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow ring-2 ring-card">{count>99?"99+":count}</span>}
    </span>
    {expandedItem
      ? <span className="min-w-0"><span className="block truncate">{label}</span><span className="mt-0.5 block line-clamp-2 text-[10px] font-normal text-muted-foreground">{help.description}</span></span>
      : <span className="max-w-full truncate">{label}</span>}
   </Link>
 }

 return <>{tourPreview&&sandboxHelp&&<div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[170] rounded-2xl border border-violet-500/40 bg-background/95 p-4 shadow-2xl backdrop-blur"><p className="text-sm font-bold">{sandboxHelp}</p><button type="button" onClick={()=>setSandboxHelp("")} className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold">{{nl:"BEGREPEN",en:"GOT IT",fr:"COMPRIS",de:"VERSTANDEN"}[trainingLocale]}</button></div>}<nav aria-label={{nl:"Mobiele navigatie",en:"Mobile navigation",fr:"Navigation mobile",de:"Mobile Navigation"}[trainingLocale]} className="fixed inset-x-0 bottom-0 z-50 min-h-14 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
  {expanded&&
   <div className="absolute inset-x-0 bottom-full max-h-[60dvh] overflow-y-auto border-t border-border bg-card/98 p-3 shadow-2xl">
    <div className="grid grid-cols-2 gap-2">
     {items.map(item=><NavItem key={item.key} item={item} expandedItem/>)}
    </div>
   </div>
  }

  <div className="flex items-stretch gap-1 px-2 py-1.5">
   <div className="flex min-w-0 flex-1 items-stretch gap-1">
    {compactItems.map(item=><NavItem key={item.key} item={item}/>)}
   </div>
   {items.length>compactItems.length&&
    <button
     type="button"
     aria-label={expanded?{nl:"Navigatie inklappen",en:"Collapse navigation",fr:"Réduire la navigation",de:"Navigation einklappen"}[trainingLocale]:{nl:"Navigatie uitklappen",en:"Expand navigation",fr:"Développer la navigation",de:"Navigation ausklappen"}[trainingLocale]}
     aria-expanded={expanded}
     onClick={()=>{setExpanded(value=>!value);if(!expanded&&trainingNavTarget==="workplaces"){const m={nl:"Open nu Werkplaatsen & shifts.",en:"Now open Workplaces & shifts.",fr:"Ouvrez maintenant Postes de travail & shifts.",de:"Öffne jetzt Arbeitsplätze & Schichten."}[trainingLocale];setSandboxHelp(m)}}
     className={cn(
       "flex w-11 shrink-0 items-center justify-center rounded-lg border border-border",
       expanded?"bg-violet-500/10 text-violet-400":"text-muted-foreground",
       trainingNavTarget&&!expanded?"ring-4 ring-violet-500 animate-pulse":"",
     )}
    >
     {expanded?<ChevronDown className="h-5 w-5"/>:<ChevronUp className="h-5 w-5"/>}
    </button>
   }
  </div>
 </nav></>
}
