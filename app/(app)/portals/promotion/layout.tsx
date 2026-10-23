import Link from "next/link"
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
 if(!current.isOwner&&!current.isAdmin&&(error||!canOpenPortal("promotion",(data??[]) as PortalAssignment[],{approved:current.approved,blocked:current.account_blocked===true})))redirect("/portals")
 const {data:blocked,error:blockError}=await (await createClient()).rpc("upt_promotion_is_blocked")
 if(!current.isOwner&&!current.isAdmin&&(blockError||blocked))redirect("/portals")
 const locale=await requestUiLocale()
 const tabs=[
  {href:"/portals/promotion",name:{nl:"Overzicht",fr:"Aperçu",en:"Overview",de:"Übersicht"},icon:"⌂"},
  {href:"/portals/promotion/tasks",name:{nl:"Taken",fr:"Tâches",en:"Tasks",de:"Aufgaben"},icon:"☑"},
  {href:"/chat",name:{nl:"Chats",fr:"Discussions",en:"Chats",de:"Chats"},icon:"◉"},
  {href:"/notifications",name:{nl:"Meldingen",fr:"Notifications",en:"Alerts",de:"Meldungen"},icon:"♧"},
 ] as const
 return <><div className="pb-24">{children}</div><nav aria-label={({nl:"Promotienavigatie",fr:"Navigation promotion",en:"Promotion navigation",de:"Promotionnavigation"} as const)[locale]} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">{tabs.map(tab=><Link key={tab.href} href={tab.href} className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] font-semibold text-violet-400"><span aria-hidden className="text-xl">{tab.icon}</span>{tab.name[locale]}</Link>)}</nav></>
}
