"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LayoutDashboard, FileText, CalendarDays, ListTodo } from "lucide-react"
import { administrationModules } from "@/lib/administration/modules"
import { activeUiLocale } from "@/lib/locale-preferences"

export function AdministrationNavigation() {
 const pathname=usePathname()
 const [expanded,setExpanded]=useState(false)
 const locale=activeUiLocale()
 const items=[
  {slug:"dashboard",href:"/portals/administration",title:{nl:"Overzicht",fr:"Vue d'ensemble",en:"Overview",de:"Übersicht"}[locale],icon:LayoutDashboard},
  {slug:"finance",href:"/portals/administration/finance",title:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"}[locale],icon:FileText},
  {slug:"rosters",href:"/portals/administration/rosters",title:{nl:"Werkroosters",fr:"Plannings",en:"Rosters",de:"Dienstpläne"}[locale],icon:CalendarDays},
  ...administrationModules.filter(m=>m.slug!=="dashboard"&&m.slug!=="finance").map(m=>({slug:m.slug,href:`/portals/administration/modules/${m.slug}`,title:m.title[locale],icon:ListTodo})),
 ]
 const active=items.findIndex(item=>pathname===item.href||(item.slug==="dashboard"&&pathname==="/portals/administration/overview"))
 const first=Math.max(0,Math.min(items.length-3,active-1))
 const shown=items.slice(first,first+3)
 const itemLink=(item:typeof items[number])=>{const Icon=item.icon;return <Link key={item.slug} href={item.href} onClick={()=>setExpanded(false)} aria-current={pathname===item.href?"page":undefined} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs ${pathname===item.href?"bg-violet-500/15 text-violet-400":"text-muted-foreground"}`}><Icon className="h-5 w-5"/><span className="max-w-full truncate">{item.title}</span></Link>}
 return <nav aria-label="Administratie navigatie" className="fixed inset-x-0 bottom-0 z-[65] border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
  {expanded&&<div className="absolute inset-x-0 bottom-full max-h-[65dvh] overflow-y-auto border-t bg-card p-3 shadow-2xl"><div className="grid grid-cols-3 gap-2">{items.map(item=>itemLink(item))}</div></div>}
  <div className="flex items-stretch gap-1 p-2">{shown.map(item=>itemLink(item))}<button type="button" aria-label={expanded?"Sluit administratieve tabs":"Alle administratieve tabs"} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)} className="flex w-14 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400"><ChevronDown className={`h-6 w-6 transition-transform ${expanded?"rotate-180":""}`}/></button></div>
 </nav>
}
