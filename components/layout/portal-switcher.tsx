import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {userVisiblePortals,type PortalAssignment} from "@/lib/portal-access"
import {requestUiLocale} from "@/lib/server-locale"
import {PortalSwitcherLinks} from "@/components/layout/portal-switcher-links"

export async function PortalSwitcher(){
 const current=await getCurrentUser()
 if(!current)return null
 const {data,error}=await (await createClient()).rpc("upt_my_portal_assignments")
 const portals=userVisiblePortals(error?[]:(data??[]) as PortalAssignment[],{
  approved:current.approved,blocked:current.account_blocked===true,
  isOwner:current.isOwner,realIsAdmin:current.realIsAdmin,role:current.role,
 })
 if(portals.length<2)return null
 const locale=await requestUiLocale()
 return <PortalSwitcherLinks portals={portals} locale={locale}/>
}
