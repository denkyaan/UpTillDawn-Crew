import {PromotionBottomNav} from "@/components/promotion/promotion-bottom-nav"
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
 return <><div className="pb-24">{children}</div><PromotionBottomNav locale={locale}/></>
}
