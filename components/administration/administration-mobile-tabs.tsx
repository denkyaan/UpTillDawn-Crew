"use client"
import Link from "next/link"
import { LayoutDashboard, CalendarDays, Wallet, Users, Megaphone, Settings2 } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { administrationModules } from "@/lib/administration/modules"
import type { SupportedUiLocale } from "@/lib/locale-preferences"

const categories=[
 {id:"overview",name:{nl:"Overzicht",fr:"Accueil",en:"Overview",de:"Übersicht"},icon:LayoutDashboard,slugs:["dashboard"]},
 {id:"events",name:{nl:"Evenementen",fr:"Événements",en:"Events",de:"Events"},icon:CalendarDays,slugs:["events","artists","contracts","logistics","permits"]},
 {id:"finance",name:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"},icon:Wallet,slugs:["finance","invoices","banking","ticketing"]},
 {id:"operations",name:{nl:"Organisatie",fr:"Organisation",en:"Operations",de:"Organisation"},icon:Users,slugs:["staff","inventory","tasks","contacts"]},
 {id:"promotion",name:{nl:"Promotie",fr:"Promotion",en:"Promotion",de:"Werbung"},icon:Megaphone,slugs:["marketing","sponsors"]},
 {id:"management",name:{nl:"Beheer",fr:"Gestion",en:"Manage",de:"Verwaltung"},icon:Settings2,slugs:["documents","reports","notifications","automations","ai","settings"]},
] as const
function href(slug:string){return slug==="dashboard"?"/portals/administration":slug==="finance"?"/portals/administration/finance":"/portals/administration/modules/"+slug}
export function AdministrationMobileTabs({locale}:{locale:SupportedUiLocale}){
 const pathname=usePathname()
 const [expanded,setExpanded]=useState<string|null>(null)
 const current=categories.find(group=>group.slugs.some(slug=>href(slug)===pathname))
 const selected=categories.find(group=>group.id===expanded)
 return <div className="relative shrink-0 border-t border-border bg-card lg:hidden">
  {selected&&<div className="absolute bottom-full left-0 right-0 max-h-[50dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-3 shadow-2xl">
   <div className="mb-2 flex items-center justify-between gap-2 px-2"><span className="text-sm font-bold">{selected.name[locale]}</span><button type="button" onClick={()=>setExpanded(null)} aria-label={({nl:"Sluiten",fr:"Fermer",en:"Close",de:"Schließen"} as const)[locale]} className="rounded-lg px-3 py-2 text-sm text-muted-foreground">✕</button></div>
   <div className="grid grid-cols-2 gap-2">
    {selected.slugs.map(slug=>{
     const adminModule=administrationModules.find(item=>item.slug===slug)
     if(!adminModule)return null
     return <Link key={slug} href={href(slug)} onClick={()=>setExpanded(null)} className={`rounded-xl border p-3 text-sm font-semibold ${pathname===href(slug)?"border-violet-500 bg-violet-600 text-white":"border-border text-foreground hover:border-violet-500"}`}>{adminModule.title[locale]}</Link>
    })}
   </div>
  </div>}
  <nav aria-label={({nl:"Administratietabs",fr:"Onglets administratifs",en:"Administration tabs",de:"Verwaltungsregister"} as const)[locale]} className="grid w-full grid-cols-6 pb-[env(safe-area-inset-bottom)]">
   {categories.map(group=>{
    const active=expanded===group.id||(!expanded&&current?.id===group.id)
    const Icon=group.icon
    return group.id==="overview"
     ? <Link key={group.id} href="/portals/administration" onClick={()=>setExpanded(null)} aria-current={pathname==="/portals/administration"?"page":undefined} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-0.5 py-2 text-center text-[9px] font-semibold ${active?"border-violet-500 text-violet-400":"border-transparent text-muted-foreground"}`}><Icon className="h-5 w-5 shrink-0"/><span className="w-full truncate">{group.name[locale]}</span></Link>
     : <button key={group.id} type="button" aria-expanded={expanded===group.id} onClick={()=>setExpanded(value=>value===group.id?null:group.id)} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 border-t-2 px-0.5 py-2 text-center text-[9px] font-semibold ${active?"border-violet-500 text-violet-400":"border-transparent text-muted-foreground"}`}><Icon className="h-5 w-5 shrink-0"/><span className="w-full truncate">{group.name[locale]}</span></button>
   })}
  </nav>
 </div>
}
