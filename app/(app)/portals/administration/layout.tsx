import { AdministrationNavigation } from "@/components/administration/administration-navigation"
import {requestUiLocale} from "@/lib/server-locale"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import type {SupabaseClient} from "@supabase/supabase-js"
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
 const s=(await createClient()) as unknown as SupabaseClient
 const {data:deputy}=!user.realIsAdmin?await s.from('upt_organization_leadership').select('slot').eq('user_id',user.id).in('slot',['left_hand','right_hand']).maybeSingle():{data:null}
 const deputyName=deputy?.slot==='left_hand'?({nl:'Linkerhand',fr:'Bras gauche',en:'Left hand',de:'Linke Hand'} as const)[locale]:deputy?.slot==='right_hand'?({nl:'Rechterhand',fr:'Bras droit',en:'Right hand',de:'Rechte Hand'} as const)[locale]:null
 return <><AdministrationNavigation initialLocale={locale} canManagePromotion={Boolean(user.isOwner||user.realIsAdmin)}/><div className="pb-64 lg:pb-0">{deputyName&&<div className="mx-auto mt-2 max-w-6xl rounded-lg border px-3 py-2 text-xs font-semibold text-violet-400">{deputyName}</div>}{children}</div></>
}
