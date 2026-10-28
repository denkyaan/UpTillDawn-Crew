import Link from "next/link"
import {LayoutDashboard, ClipboardCheck, MessagesSquare, Bell} from "lucide-react"
import {getCurrentUser} from "@/lib/actions/auth"
import {redirect} from "next/navigation"
import {requestUiLocale} from "@/lib/server-locale"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
export const dynamic="force-dynamic"
export default async function PromotionLayout({children}:{children:React.ReactNode}){
 const current=await getCurrentUser()
 if(!current)redirect("/login")
 const {data,error}=await (await createClient()).rpc("upt_my_portal_assignments")
 if(!current.isOwner&&!current.realIsAdmin&&(error||!canOpenPortal("promotion",(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true})))redirect("/portals")
 const locale=await requestUiLocale()
 const tabs=[
  {href:"/portals/promotion",name:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},icon:LayoutDashboard},
  {href:"/portals/promotion/tasks",name:{nl:"Taken",fr:"Tâches",en:"Tasks",de:"Aufgaben"},icon:ClipboardCheck},
  {href:"/portals/promotion/chats",name:{nl:"Chats",fr:"Discussions",en:"Chats",de:"Chats"},icon:MessagesSquare},
  {href:"/portals/promotion/notifications",name:{nl:"Meldingen",fr:"Notifications",en:"Alerts",de:"Meldungen"},icon:Bell},
 ] as const
 return <><div className="pb-24">{children}</div><nav aria-label={({nl:"Promotienavigatie",fr:"Navigation promotion",en:"Promotion navigation",de:"Promotionnavigation"} as const)[locale]} className="fixed inset-x-0 bottom-0 z-[65] grid grid-cols-4 border-t border-border bg-card/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.15)] backdrop-blur-lg lg:hidden">{tabs.map(tab=>{const Icon=tab.icon;return <Link key={tab.href} href={tab.href} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500"><Icon aria-hidden="true" className="h-5 w-5 stroke-[1.8]"/><span>{tab.name[locale]}</span></Link>})}</nav></>
}
