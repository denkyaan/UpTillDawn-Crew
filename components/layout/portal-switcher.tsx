import {getCurrentUser} from "@/lib/actions/auth"
import {currentPortalAssignments} from "@/lib/portal-access-server"
import {userVisiblePortals,type PortalAssignment} from "@/lib/portal-access"
import {requestUiLocale} from "@/lib/server-locale"
import {PortalSwitcherLinks} from "@/components/layout/portal-switcher-links"

export async function PortalSwitcher(){
 const current=await getCurrentUser()
 if(!current)return null
 // Verified Admin and Maker can see all portals without another database call.
 const {data,error}=current.isOwner||current.realIsAdmin
  ?{data:[] as PortalAssignment[],error:null}
  :await currentPortalAssignments()
 const portals=userVisiblePortals(error?[]:(data??[]) as PortalAssignment[],{
  approved:current.approved,blocked:current.account_blocked===true,
  isOwner:current.isOwner,realIsAdmin:current.realIsAdmin,role:current.role,
 })
 if(portals.length<2)return null
 const locale=await requestUiLocale()
 return <PortalSwitcherLinks portals={portals} locale={locale}/>
}
