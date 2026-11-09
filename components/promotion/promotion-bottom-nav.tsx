"use client"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {LayoutDashboard,ClipboardCheck,MessagesSquare,Bell,Users} from "lucide-react"

type Locale="nl"|"fr"|"en"|"de"
const tabs=[
 {href:"/portals/promotion",name:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},icon:LayoutDashboard},
 {href:"/portals/promotion/tasks",name:{nl:"Taken",fr:"Tâches",en:"Tasks",de:"Aufgaben"},icon:ClipboardCheck},
 {href:"/portals/promotion/chats",name:{nl:"Chats",fr:"Discussions",en:"Chats",de:"Chats"},icon:MessagesSquare},
 {href:"/portals/promotion/staff",name:{nl:"Personeel",fr:"Équipe",en:"Staff",de:"Team"},icon:Users},
 {href:"/portals/promotion/notifications",name:{nl:"Meldingen",fr:"Notifications",en:"Alerts",de:"Meldungen"},icon:Bell}
] as const
export function PromotionBottomNav({locale}:{locale:Locale}){
 const pathname=usePathname()
 const label={nl:"Promotienavigatie",fr:"Navigation promotion",en:"Promotion navigation",de:"Promotionnavigation"}[locale]
 return <nav aria-label={label} className="fixed inset-x-0 bottom-0 z-[65] border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
 <div className="grid grid-cols-5 gap-0.5 px-1 py-2">{tabs.map(tab=>{const Icon=tab.icon;const active=pathname===tab.href||(tab.href!=="/portals/promotion"&&pathname.startsWith(tab.href+"/"))
 return <Link key={tab.href} href={tab.href} aria-current={active?"page":undefined} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-center text-[10px] focus-visible:outline-2 focus-visible:outline-violet-500 ${active?"bg-violet-500/15 text-violet-400":"text-muted-foreground"}`}><Icon aria-hidden="true" className="h-5 w-5 stroke-[1.8]"/><span className="w-full min-w-0 break-words text-center leading-tight">{tab.name[locale]}</span></Link>})}</div>
 </nav>
}
