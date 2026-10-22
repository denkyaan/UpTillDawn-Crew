"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { administrationModules } from "@/lib/administration/modules"
import type { SupportedUiLocale } from "@/lib/locale-preferences"

const categories=[
 {id:"overview",name:{nl:"Overzicht",fr:"Accueil",en:"Overview",de:"Übersicht"},slugs:["dashboard"]},
 {id:"events",name:{nl:"Evenementen",fr:"Événements",en:"Events",de:"Events"},slugs:["events","artists","contracts","logistics","permits"]},
 {id:"finance",name:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"},slugs:["finance","invoices","banking","ticketing"]},
 {id:"operations",name:{nl:"Organisatie",fr:"Organisation",en:"Operations",de:"Organisation"},slugs:["staff","inventory","tasks","contacts"]},
 {id:"promotion",name:{nl:"Promotie",fr:"Promotion",en:"Promotion",de:"Werbung"},slugs:["marketing","sponsors"]},
 {id:"management",name:{nl:"Beheer",fr:"Gestion",en:"Manage",de:"Verwaltung"},slugs:["documents","reports","notifications","automations","ai","settings"]},
] as const
function href(slug:string){return slug==="dashboard"?"/portals/administration":slug==="finance"?"/portals/administration/finance":"/portals/administration/modules/"+slug}
export function AdministrationMobileTabs({locale}:{locale:SupportedUiLocale}){
 const pathname=usePathname()
 const [expanded,setExpanded]=useState<string|null>(null)
 useEffect(()=>setExpanded(null),[pathname])
 const current=categories.find(group=>group.slugs.some(slug=>href(slug)===pathname))
 const selected=categories.find(group=>group.id===expanded)
 return <div className="relative shrink-0 border-t border-border bg-card lg:hidden">
  {selected&&<div className="absolute bottom-full left-0 right-0 max-h-[50dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-3 shadow-2xl">
   <div className="mb-2 flex items-center justify-between gap-2 px-2"><span className="text-sm font-bold">{selected.name[locale]}</span><button type="button" onClick={()=>setExpanded(null)} aria-label={({nl:"Sluiten",fr:"Fermer",en:"Close",de:"Schließen"} as const)[locale]} className="rounded-lg px-3 py-2 text-sm text-muted-foreground">✕</button></div>
   <div className="grid grid-cols-2 gap-2">
    {selected.slugs.map(slug=>{
     const module=administrationModules.find(item=>item.slug===slug)
     if(!module)return null
     return <Link key={slug} href={href(slug)} onClick={()=>setExpanded(null)} className={`rounded-xl border p-3 text-sm font-semibold ${pathname===href(slug)?"border-violet-500 bg-violet-600 text-white":"border-border text-foreground hover:border-violet-500"}`}>{module.title[locale]}</Link>
    })}
   </div>
  </div>}
  <nav aria-label={({nl:"Administratietabs",fr:"Onglets administratifs",en:"Administration tabs",de:"Verwaltungsregister"} as const)[locale]} className="flex w-full overflow-x-auto overscroll-x-contain pb-[env(safe-area-inset-bottom)]">
   {categories.map(group=>{
    const active=expanded===group.id||(!expanded&&current?.id===group.id)
    return <button key={group.id} type="button" aria-expanded={expanded===group.id} onClick={()=>{
      if(group.id==="overview"){setExpanded(expanded===group.id?null:group.id);return}
      setExpanded(value=>value===group.id?null:group.id)
     }} className={`min-h-16 min-w-[88px] flex-1 shrink-0 border-t-2 px-2 py-3 text-center text-xs font-semibold ${active?"border-violet-500 text-violet-400":"border-transparent text-muted-foreground"}`}>{group.name[locale]}</button>
   })}
  </nav>
 </div>
}
