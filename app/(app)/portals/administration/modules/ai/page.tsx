import {redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {requestUiLocale} from "@/lib/server-locale"
import {AdministrationAiChat} from "@/components/administration/administration-ai-chat"

export const dynamic="force-dynamic"
export default async function AdministrationAiPage(){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 if(error&&!user.isAdmin&&!user.isOwner)redirect("/portals")
 if(!user.isAdmin&&!user.isOwner&&!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:user.account_blocked===true}))redirect("/portals")
 const locale=await requestUiLocale()
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6"><AdministrationAiChat locale={locale}/></main>
}
