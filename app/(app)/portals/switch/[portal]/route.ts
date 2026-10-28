import {NextRequest,NextResponse} from "next/server"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {accessiblePortals,type Portal,type PortalAssignment} from "@/lib/portal-access"
const destinations:Record<Portal,string>={events:"/",promotion:"/portals/promotion",administration:"/portals/administration"}
export async function GET(request:NextRequest,{params}:{params:Promise<{portal:string}>}){
 const {portal}=await params
 const user=await getCurrentUser()
 if(!user)return NextResponse.redirect(new URL("/login",request.url))
 if(!Object.hasOwn(destinations,portal))return NextResponse.redirect(new URL("/portals",request.url))
 const {data}=await (await createClient()).rpc("upt_my_portal_assignments")
 const allowed=accessiblePortals((data??[]) as PortalAssignment[],{approved:user.approved,blocked:user.account_blocked===true})
 if(user.isOwner||allowed.includes(portal as Portal)||(portal==="events"&&(user.realIsAdmin||user.role==="staff"||user.role==="responsible_lead"))){
  const response=NextResponse.redirect(new URL(destinations[portal as Portal],request.url))
  response.cookies.set("uptilldawn-last-portal",portal,{httpOnly:true,sameSite:"lax",secure:request.nextUrl.protocol==="https:",path:"/",maxAge:60*60*24*90})
  return response
 }
 return NextResponse.redirect(new URL("/portals",request.url))
}
