"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, CalendarDays, Clock3, Users, MessageCircle, Settings } from "lucide-react"
import { NAV_ITEMS, type NavigationItem } from "@/components/layout/navigation-items"
import { useAuth } from "@/lib/providers"
import { cn } from "@/lib/utils"
import { getDefaultRoleUiLabel, type RoleRuleRole } from "@/lib/role-ui"
import { featureHelp } from "@/lib/ui-field-help"
import { useAdminSelection } from "@/lib/admin-selection-context"
import { LANGUAGE_APPLIED_EVENT, activeUiLocale, type SupportedUiLocale } from "@/lib/locale-preferences"

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
 void assignedEvent
 void shiftActive
 const pathname=usePathname()
 const router=useRouter()
 const [selectedGroup,setSelectedGroup]=useState<{key:string;pathname:string}|null>(null)
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const {roles,isAdmin}=useAuth()
 const adminContext=useAdminSelection()
 const roleKey:RoleRuleRole=roles.includes("admin")?"admin":roles.includes("responsible_lead")?"responsible_lead":"staff"
 const order=new Map(featureOrder.map((key,index)=>[key,index]))
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const items=NAV_ITEMS.filter(i=>roles.some(r=>i.roles.includes(r))&&i.key!=="shifts"&&featureVisibility[i.key]!==false).sort((a,b)=>(order.get(a.key)??999)-(order.get(b.key)??999))
 const hrefFor=(item:NavigationItem)=>{
  const base=item.href==='/'&&isAdmin?'/admin':item.href
  return isAdmin?adminContext.href(base):base
 }
 const isActive=(item:NavigationItem)=>{
   const href=hrefFor(item)
   const path=href.split('?')[0]
   return path==='/'?pathname==='/':pathname===path||pathname.startsWith(path+'/')
 }

 const badgeCount=(key:string)=>{
   const activityCount=key==="chat"?chatMissed:key==="incidents"?incidentMissed:key==="tasks"?taskMissed:0
   return Math.max(activityCount,notificationFeatureCounts[key]??0)
 }

 const NavItem=({item}:{item:NavigationItem})=>{
   const href=hrefFor(item)
   const active=isActive(item)
   const Icon=item.icon
   const count=badgeCount(item.key)
   const label=item.key==="incidents"?({nl:"Incidenten",fr:"Incidents",en:"Incidents",de:"Vorfälle"} as const)[locale]:item.key==="help"?({nl:"Helpcentrum",fr:"Centre d’aide",en:"Help centre",de:"Hilfezentrum"} as const)[locale]:featureLabels[item.key] || getDefaultRoleUiLabel(roleKey,item.key,item.label)
   const help=featureHelp(item.key,label)
   return <Link
    data-layout-key={item.key}
    href={href}
    title={help.description}
    aria-description={help.description}
    onClick={()=>{setSelectedGroup({key:"home",pathname})}}
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[9px] font-semibold",
      active?"bg-violet-500/10 text-violet-400":"text-muted-foreground"
    )}
   >
    <span className="relative shrink-0">
     <Icon className="h-5 w-5"/>
     {count>0&&<span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white shadow ring-2 ring-card">{count>99?"99+":count}</span>}
    </span>
    <span className="min-w-0 max-w-full whitespace-normal break-words text-center leading-tight">{label}</span>
   </Link>
 }


 const groupedNavigation=[
  {key:"home",icon:LayoutDashboard,labels:{nl:"Home",fr:"Accueil",en:"Home",de:"Start"},keys:["overview"]},
  {key:"events",icon:CalendarDays,labels:{nl:"Events",fr:"Événements",en:"Events",de:"Events"},keys:["events","briefings","guestlist"]},
  {key:"work",icon:Clock3,labels:{nl:"Werk",fr:"Travail",en:"Work",de:"Arbeit"},keys:["operations","workplaces","tasks","inventory","sales"]},
  {key:"team",icon:Users,labels:{nl:"Team",fr:"Équipe",en:"Team",de:"Team"},keys:["crew","personnel","exports","platform"]},
  {key:"support",icon:MessageCircle,labels:{nl:"Contact",fr:"Contact",en:"Contact",de:"Kontakt"},keys:["chat","incidents","help"]},
  {key:"manage",icon:Settings,labels:{nl:"Beheer",fr:"Gestion",en:"Manage",de:"Verwaltung"},keys:["settings"]},
 ] as const
 const availableGroups=groupedNavigation.map(group=>({...group,entries:group.keys.map(key=>items.find(item=>item.key===key)).filter((item):item is NavigationItem=>Boolean(item))})).filter(group=>group.entries.length>0)
 const currentGroup=availableGroups.find(group=>group.entries.some(isActive))?.key??"home"
 const activeGroup=selectedGroup?.pathname===pathname&&availableGroups.some(group=>group.key===selectedGroup.key)?selectedGroup.key:"home"
 const selectedEntries=availableGroups.find(group=>group.key===activeGroup)?.entries??[]
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedGroup({key:"home",pathname})};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[pathname])
 useEffect(()=>{window.dispatchEvent(new CustomEvent("uptilldawn-navigation-expanded",{detail:{open:activeGroup!=="home"}}));return()=>{window.dispatchEvent(new CustomEvent("uptilldawn-navigation-expanded",{detail:{open:false}}))}},[activeGroup])
 return <nav aria-label={{nl:"Mobiele navigatie",en:"Mobile navigation",fr:"Navigation mobile",de:"Mobile Navigation"}[locale]} className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
  {activeGroup!=="home"&&<div id="role-navigation-subtabs" className="border-b bg-card p-2">
   <div className="grid max-h-[38dvh] grid-cols-3 gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain">{selectedEntries.map(item=><NavItem key={item.key} item={item}/>)}</div>
  </div>}
  <div className="grid gap-0.5 px-1 py-2" style={{gridTemplateColumns:`repeat(${availableGroups.length},minmax(0,1fr))`}}>
   {availableGroups.map(group=>{const Icon=group.icon;const active=activeGroup===group.key||(activeGroup==="home"&&currentGroup===group.key);return <button type="button" key={group.key} data-role-category={group.key} aria-pressed={active} aria-label={group.labels[locale]} aria-expanded={group.key==="home"?undefined:activeGroup===group.key} aria-controls={group.key==="home"||activeGroup!==group.key?undefined:"role-navigation-subtabs"} onClick={()=>{if(group.key==="home"){setSelectedGroup(null);router.push(isAdmin?"/admin":"/");return}setSelectedGroup(previous=>({key:previous?.pathname===pathname&&previous.key===group.key?"home":group.key,pathname}))}} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-[10px]",active?"bg-violet-500/15 text-violet-400":"text-muted-foreground")}><Icon className="h-5 w-5"/><span className="w-full min-w-0 break-words text-center leading-tight">{group.labels[locale]}</span></button>})}
  </div>
 </nav>

}
