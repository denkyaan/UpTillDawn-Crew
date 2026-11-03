import { AdministrationNavigation } from "@/components/administration/administration-navigation"
import {requestUiLocale} from "@/lib/server-locale"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {redirect} from "next/navigation"

export const dynamic="force-dynamic"

export default async function AdministrationLayout({children}:{children:React.ReactNode}){
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 if(!user.isOwner&&!user.realIsAdmin){
  const {data,error}=await (await createClient()).rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:user.account_blocked===true}))redirect("/portals")
 }
 const locale=await requestUiLocale()
 return <><AdministrationNavigation initialLocale={locale} canManagePromotion={Boolean(user.isOwner||user.realIsAdmin)}/><div className="pb-64 lg:pb-0">{children}</div></>
}
