"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { SupportedUiLocale } from "@/lib/locale-preferences"
import { administrationModules, administrationCopy } from "@/lib/administration/modules"

const groups=[
 {id:"overview",titles:{nl:"Overzicht",fr:"Vue d'ensemble",en:"Overview",de:"Übersicht"},slugs:["dashboard"]},
 {id:"events",titles:{nl:"Evenementen & productie",fr:"Événements et production",en:"Events & production",de:"Events & Produktion"},slugs:["events","artists","contracts","logistics","permits"]},
 {id:"finance",titles:{nl:"Financiën & verkoop",fr:"Finances et ventes",en:"Finance & sales",de:"Finanzen & Vertrieb"},slugs:["finance","invoices","banking","ticketing"]},
 {id:"operations",titles:{nl:"Personeel & organisatie",fr:"Personnel et organisation",en:"People & operations",de:"Personal & Organisation"},slugs:["staff","inventory","tasks","contacts"]},
 {id:"growth",titles:{nl:"Promotie & partners",fr:"Promotion et partenaires",en:"Promotion & partners",de:"Werbung & Partner"},slugs:["marketing","sponsors"]},
 {id:"management",titles:{nl:"Documenten & beheer",fr:"Documents et gestion",en:"Documents & management",de:"Dokumente & Verwaltung"},slugs:["documents","reports","notifications","automations","ai","settings"]},
] as const

function hrefFor(slug:string){return slug==="dashboard"?"/portals/administration":slug==="finance"?"/portals/administration/finance":"/portals/administration/modules/"+slug}

export function AdministrationNavigation({locale}:{locale:SupportedUiLocale}){
 const pathname=usePathname()
 const t=administrationCopy[locale]
 return <nav aria-label={t.navigation} className="space-y-1">
  {groups.map(group=>{
   const selected=group.slugs.some(slug=>pathname===hrefFor(slug))
   return <details key={group.id} open={selected?true:undefined} className="group rounded-xl">
    <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden ${selected?"bg-violet-500/15 text-violet-300":"text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
     <span>{group.titles[locale]}</span><span aria-hidden="true" className="text-xs transition-transform group-open:rotate-90">▸</span>
    </summary>
    <div className="ml-3 space-y-1 border-l border-border py-1 pl-2">
     {group.slugs.map(slug=>{
      const item=administrationModules.find(entry=>entry.slug===slug)
      if(!item)return null
      const href=hrefFor(slug)
      const active=pathname===href
      return <Link key={slug} href={href} aria-current={active?"page":undefined} className={`flex min-h-10 items-center rounded-lg px-3 py-2 text-sm transition-colors ${active?"bg-violet-600 font-semibold text-white":"text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.title[locale]}</Link>
     })}
    </div>
   </details>
  })}
 </nav>
}
