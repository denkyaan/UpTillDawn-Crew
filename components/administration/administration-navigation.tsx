"use client"
import {useEffect,useState} from "react"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {LayoutDashboard,CalendarDays,Wallet,Boxes,Users,Settings,FileText,ClipboardList,Music,FileSignature,UserRoundCheck,CalendarClock,Receipt,Landmark,Ticket,ChartNoAxesColumn,Package,Truck,FolderOpen,ShieldCheck,Contact,Handshake,Megaphone,Bell,Workflow,Bot,ShieldBan,SlidersHorizontal,MessagesSquare,MessageCircle} from "lucide-react"
import {administrationModules} from "@/lib/administration/modules"
import {administrationNavigationGroups,administrationRoute,administrationCategoryForPath} from "@/lib/administration/navigation"
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from "@/lib/locale-preferences"

const categoryIcons={overview:LayoutDashboard,planning:CalendarDays,finance:Wallet,operations:Boxes,relations:Users,management:Settings}
const categories=administrationNavigationGroups
const route=administrationRoute
const subtabIcons:Record<string,typeof LayoutDashboard>={
 dashboard:LayoutDashboard,events:CalendarDays,artists:Music,contracts:FileSignature,staff:UserRoundCheck,tasks:ClipboardList,rosters:CalendarClock,
 finance:Wallet,invoices:Receipt,banking:Landmark,ticketing:Ticket,reports:ChartNoAxesColumn,
 inventory:Package,logistics:Truck,documents:FolderOpen,permits:ShieldCheck,
 personnel:Users,chat:MessagesSquare,contacts:Contact,sponsors:Handshake,marketing:Megaphone,
 notifications:Bell,automations:Workflow,ai:Bot,"promotion-discipline":ShieldBan,settings:SlidersHorizontal
}
export function AdministrationNavigation({initialLocale,canManagePromotion}:{initialLocale:SupportedUiLocale;canManagePromotion:boolean}){
 const pathname=usePathname()
 const [locale,setLocale]=useState(initialLocale)
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const [selectedCategory,setSelectedCategory]=useState<{key:string;pathname:string}|null>(null)
 const current=administrationCategoryForPath(pathname)
 const selected=categories.find(group=>group.key===(selectedCategory?.pathname===pathname?selectedCategory.key:current))!
 const visible=selected.key!=="overview"
 return <><Link href="/portals/administration/chat" aria-label={({nl:"Chat openen",fr:"Ouvrir les discussions",en:"Open chat",de:"Chat öffnen"} as const)[locale]} className="fixed bottom-24 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black text-white shadow-lg lg:bottom-6" title={({nl:"Chat",fr:"Discussions",en:"Chat",de:"Chat"} as const)[locale]}><MessageCircle className="h-6 w-6"/></Link><nav aria-label={({nl:"Administratie navigatie",fr:"Navigation administrative",en:"Administration navigation",de:"Verwaltungsnavigation"} as const)[locale]} className="fixed inset-x-0 bottom-0 z-[65] border-t bg-card pb-[env(safe-area-inset-bottom)] lg:sticky lg:top-0 lg:inset-x-auto lg:border-x lg:rounded-xl">
 {visible&&<div className="border-b bg-card p-2"><strong className="mb-2 block text-xs">{selected.title[locale]}</strong><div className="grid grid-cols-3 gap-1.5">{selected.slugs.filter(slug=>slug!=="promotion-discipline"||canManagePromotion).map(slug=>{const m=administrationModules.find(item=>item.slug===slug);const title=slug==="personnel"?({nl:"Personeel",fr:"Personnel",en:"Staff",de:"Personal"} as const)[locale]:slug==="chat"?({nl:"Chats",fr:"Discussions",en:"Chats",de:"Chats"} as const)[locale]:slug==="promotion-discipline"?({nl:"Promotieblokkeringen",fr:"Blocages promotion",en:"Promotion restrictions",de:"Promotion-Sperren"} as const)[locale]:slug==="rosters"?({nl:"Werkroosters",fr:"Plannings",en:"Rosters",de:"Dienstpläne"} as const)[locale]:m?.title[locale]??slug;const Icon=subtabIcons[slug]??FileText;return <Link key={slug} data-administration-subtab={slug} href={route(slug)} onClick={()=>setSelectedCategory(null)} aria-current={pathname===route(slug)?"page":undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-[11px] ${pathname===route(slug)?"border-violet-500 text-violet-400":"border-border"}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/><span className="w-full truncate">{title}</span></Link>})}</div></div>}
 <div className="grid grid-cols-6 gap-0.5 px-1 py-2">{categories.map(group=>{const Icon=categoryIcons[group.key];const active=group.key===selected.key;return <button type="button" key={group.key} data-administration-category={group.key} onClick={()=>group.key==="overview"?window.location.assign("/portals/administration"):setSelectedCategory({key:group.key,pathname})} aria-pressed={selected.key===group.key} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-[10px] ${active?"bg-violet-500/15 text-violet-400":"text-muted-foreground"}`}><Icon className="h-5 w-5"/><span className="max-w-full truncate">{group.title[locale]}</span></button>})}</div>
 </nav></>
}
