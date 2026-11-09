"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/providers"
import { cn } from "@/lib/utils"
import { Shield, LayoutDashboard, CalendarDays, Clock3, Users, MessageCircle, Settings } from "lucide-react"
import { NAV_ITEMS } from "@/components/layout/navigation-items"
import { getDefaultRoleUiLabel, type RoleRuleRole } from "@/lib/role-ui"
import { featureHelp } from "@/lib/ui-field-help"
import { activeUiLocale, LANGUAGE_APPLIED_EVENT, type SupportedUiLocale } from "@/lib/locale-preferences"
import { useAdminSelection } from "@/lib/admin-selection-context"
import {adminAdministrationGroupKeys,adminAdministrationLabel} from "@/lib/admin-administration-navigation"

export function AppSidebar({
  chatMissed=0,incidentMissed=0,taskMissed=0,notificationFeatureCounts={},
  showOperations=false,showEvents=false,showTasks=false,showBriefings=false,showShifts=false,showWorkplaces=false,showIncidents=false,
  featureOrder=[],featureLabels={},featureVisibility={},
}:{
  chatMissed?:number;incidentMissed?:number;taskMissed?:number;notificationFeatureCounts?:Record<string,number>;
  showOperations?:boolean;showEvents?:boolean;showTasks?:boolean;showBriefings?:boolean;showShifts?:boolean;showWorkplaces?:boolean;showIncidents?:boolean;
  featureOrder?:string[];featureLabels?:Record<string,string>;featureVisibility?:Record<string,boolean>;
}) {
 const pathname=usePathname()
 const router=useRouter()
 const [locale,setLocale]=useState<SupportedUiLocale>("nl")
 const [selectedGroup,setSelectedGroup]=useState<{key:string;pathname:string}|null>(null)
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const {roles,isAdmin}=useAuth()
 const adminContext=useAdminSelection()
 const roleKey:RoleRuleRole=roles.includes("admin")?"admin":roles.includes("responsible_lead")?"responsible_lead":"staff"
 const order=new Map(featureOrder.map((key,index)=>[key,index]))
 const visible=NAV_ITEMS.filter(i=>{
   if(!roles.some(r=>i.roles.includes(r))) return false
   if(i.key==="shifts") return false
   if(Object.prototype.hasOwnProperty.call(featureVisibility,i.key)&&!featureVisibility[i.key]) return false
   if(i.key==="operations") return showOperations
   if(i.key==="events") return showEvents
   if(i.key==="tasks") return showTasks
   if(i.key==="briefings") return showBriefings
   if(i.key==="workplaces") return showWorkplaces
   if(i.key==="shifts") return showShifts
   if(i.key==="incidents") return showIncidents
   return true
 }).sort((a,b)=>(order.get(a.key)??999)-(order.get(b.key)??999))

 const groups=[
  {key:"home",icon:LayoutDashboard,title:{nl:"Home",fr:"Accueil",en:"Home",de:"Start"},keys:["overview"]},
  {key:"events",icon:CalendarDays,title:{nl:"Events",fr:"Événements",en:"Events",de:"Events"},keys:["events","briefings","guestlist",...adminAdministrationGroupKeys.events]},
  {key:"work",icon:Clock3,title:{nl:"Werk",fr:"Travail",en:"Work",de:"Arbeit"},keys:["operations","workplaces","tasks","inventory","sales","exports",...adminAdministrationGroupKeys.work]},
  {key:"team",icon:Users,title:{nl:"Team",fr:"Équipe",en:"Team",de:"Team"},keys:["crew","personnel",...adminAdministrationGroupKeys.team]},
  {key:"support",icon:MessageCircle,title:{nl:"Contact",fr:"Contact",en:"Contact",de:"Kontakt"},keys:["chat","incidents","help",...adminAdministrationGroupKeys.support]},
  {key:"manage",icon:Settings,title:{nl:"Beheer",fr:"Gestion",en:"Manage",de:"Verwaltung"},keys:["settings","platform",...adminAdministrationGroupKeys.manage]},
 ] as const
 const availableGroups=groups.map(group=>({...group,entries:group.keys.map(key=>visible.find(item=>item.key===key)).filter((item):item is (typeof visible)[number]=>Boolean(item))})).filter(group=>group.entries.length>0)
 const routeActive=(href:string)=>href==="/"?pathname==="/":pathname===href||pathname.startsWith(href+"/")
 const currentGroup=availableGroups.find(group=>group.entries.some(item=>routeActive(item.href==="/"&&isAdmin?"/admin":item.href)))?.key??"home"
 const activeGroup=selectedGroup?.pathname===pathname&&availableGroups.some(group=>group.key===selectedGroup.key)?selectedGroup.key:currentGroup
 const selectedEntries=availableGroups.find(group=>group.key===activeGroup)?.entries??[]
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelectedGroup({key:"home",pathname})};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[pathname])

 return <aside className="hidden lg:flex w-[250px] h-dvh sticky top-0 min-h-0 flex-col overflow-hidden border-r border-border bg-card">
  <Link href={isAdmin?"/admin":"/"} className="h-16 flex items-center gap-3 px-5 border-b border-border">
   <Image src="/up-till-dawn-mark.webp" alt="UP TILL DAWN" width={36} height={36} className="h-9 w-9 rounded-xl object-cover" priority />
   <div><div className="font-black tracking-wide">UP TILL DAWN</div><div className="text-[10px] text-muted-foreground tracking-[.18em]">PERSONEELSBEHEER</div></div>
  </Link>
  <nav aria-label={{nl:"Navigatie",fr:"Navigation",en:"Navigation",de:"Navigation"}[locale]} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-6">
   <div className="grid grid-cols-3 gap-1">{availableGroups.map(group=>{const Icon=group.icon;return <button key={group.key} type="button" data-role-category={group.key} aria-pressed={activeGroup===group.key} onClick={()=>{setSelectedGroup({key:group.key,pathname});if(group.key==="home")router.push(isAdmin?"/admin":"/")}} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-lg p-2 text-[11px]",activeGroup===group.key?"bg-violet-500/15 text-violet-400":"text-muted-foreground")}><Icon className="h-5 w-5"/><span className="truncate">{group.title[locale]}</span></button>})}</div>
   <div className="mt-4 space-y-1 border-t pt-3">{selectedEntries.map(i=>{
    const baseHref=i.href==="/"&&isAdmin?"/admin":i.href
    const href=isAdmin?adminContext.href(baseHref):baseHref
    const active=routeActive(baseHref)
    const Icon=i.icon
    const count=Math.max(i.key==="chat"?chatMissed:i.key==="incidents"?incidentMissed:i.key==="tasks"?taskMissed:0,notificationFeatureCounts[i.key]??0)
    const label=i.key==="incidents"?({nl:"Incidenten",fr:"Incidents",en:"Incidents",de:"Vorfälle"} as const)[locale]:i.key==="help"?({nl:"Helpcentrum",fr:"Centre d’aide",en:"Help centre",de:"Hilfezentrum"} as const)[locale]:adminAdministrationLabel(i.key,locale)||featureLabels[i.key]||getDefaultRoleUiLabel(roleKey,i.key,i.label)
    const help=featureHelp(i.key,label)
    return <Link data-layout-key={i.key} key={i.key} href={href} title={help.description} aria-description={help.description} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold",active?"bg-violet-600 text-white":"text-muted-foreground hover:bg-muted hover:text-foreground")}><span className="relative"><Icon className="h-5 w-5"/>{count>0&&<span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white">{count>99?"99+":count}</span>}</span>{label}</Link>
   })}</div>
  </nav>
  <div className="shrink-0 border-t border-border p-4"><div className="text-[11px] text-muted-foreground flex gap-2"><Shield className="h-4 w-4"/>Beveiligde personeelsoperaties</div></div>
 </aside>
}
