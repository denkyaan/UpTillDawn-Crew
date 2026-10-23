"use client"
import {useState} from "react"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {LayoutDashboard,CalendarDays,Wallet,Boxes,Users,Settings,ChevronDown,FileText,ClipboardList} from "lucide-react"
import {administrationModules} from "@/lib/administration/modules"
import {activeUiLocale} from "@/lib/locale-preferences"

const categories=[
 {key:"overview",icon:LayoutDashboard,title:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},slugs:["dashboard"]},
 {key:"planning",icon:CalendarDays,title:{nl:"Planning",fr:"Planification",en:"Planning",de:"Planung"},slugs:["events","artists","contracts","staff","tasks","rosters"]},
 {key:"finance",icon:Wallet,title:{nl:"Financiën",fr:"Finances",en:"Finance",de:"Finanzen"},slugs:["finance","invoices","banking","ticketing","reports"]},
 {key:"operations",icon:Boxes,title:{nl:"Operaties",fr:"Opérations",en:"Operations",de:"Betrieb"},slugs:["inventory","logistics","documents","permits"]},
 {key:"relations",icon:Users,title:{nl:"Relaties",fr:"Relations",en:"Relations",de:"Kontakte"},slugs:["contacts","sponsors","marketing"]},
 {key:"management",icon:Settings,title:{nl:"Beheer",fr:"Gestion",en:"Management",de:"Verwaltung"},slugs:["notifications","automations","ai","promotion-discipline","settings"]},
] as const
const route=(slug:string)=>slug==="dashboard"?"/portals/administration":slug==="finance"?"/portals/administration/finance":slug==="rosters"?"/portals/administration/rosters":slug==="promotion-discipline"?"/portals/administration/promotion-discipline":`/portals/administration/modules/${slug}`
export function AdministrationNavigation(){
 const pathname=usePathname()
 const locale=activeUiLocale()
 const [opened,setOpened]=useState<string|null>(null)
 const current=categories.find(group=>group.slugs.some(slug=>route(slug)===pathname))?.key??"overview"
 const selected=categories.find(group=>group.key===(opened??current))!
 const visible=opened!==null
 return <nav aria-label={({nl:"Administratie navigatie",fr:"Navigation administrative",en:"Administration navigation",de:"Verwaltungsnavigation"} as const)[locale]} className="fixed inset-x-0 bottom-0 z-[65] border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
 {visible&&<div className="absolute inset-x-0 bottom-full max-h-[55dvh] overflow-y-auto border-t bg-card p-3 shadow-xl"><div className="mb-2 flex items-center justify-between"><strong className="text-sm">{selected.title[locale]}</strong><button type="button" onClick={()=>setOpened(null)} aria-label={({nl:"Sluiten",fr:"Fermer",en:"Close",de:"Schließen"} as const)[locale]}><ChevronDown className="h-5 w-5"/></button></div><div className="grid grid-cols-2 gap-2">{selected.slugs.map(slug=>{const m=administrationModules.find(item=>item.slug===slug);const title=slug==="promotion-discipline"?({nl:"Promotieblokkeringen",fr:"Blocages promotion",en:"Promotion restrictions",de:"Promotion-Sperren"} as const)[locale]:slug==="rosters"?({nl:"Werkroosters",fr:"Plannings",en:"Rosters",de:"Dienstpläne"} as const)[locale]:slug==="dashboard"?({nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"} as const)[locale]:m?.title[locale]??slug;const Icon=slug==="finance"?FileText:ClipboardList;return <Link key={slug} href={route(slug)} onClick={()=>setOpened(null)} className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${pathname===route(slug)?"border-violet-500 text-violet-400":"border-border"}`}><Icon className="h-4 w-4 shrink-0"/>{title}</Link>})}</div></div>}
 <div className="grid grid-cols-6 gap-0.5 px-1 py-2">{categories.map(group=>{const Icon=group.icon;const active=group.key===current;return <button type="button" key={group.key} onClick={()=>group.key==="overview"?(setOpened(null),window.location.assign("/portals/administration")):setOpened(opened===group.key?null:group.key)} aria-expanded={opened===group.key} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-[10px] ${active?"bg-violet-500/15 text-violet-400":"text-muted-foreground"}`}><Icon className="h-5 w-5"/><span className="max-w-full truncate">{group.title[locale]}</span></button>})}</div>
 </nav>
}
