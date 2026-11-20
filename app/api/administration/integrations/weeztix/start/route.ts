import {NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {getManagedIntegrationConfig} from "@/lib/administration/integration-store"
import {WEEZTIX_AUTH_BASE,WEEZTIX_OAUTH_STATE_COOKIE,weeztixCallbackUrl} from "@/lib/administration/weeztix-oauth"

export const dynamic="force-dynamic"
export async function GET(request:Request){
 const access=await integrationManagementAccess()
 if(!access.ok)return NextResponse.json({error:"forbidden"},{status:access.status,headers:{"Cache-Control":"no-store"}})
 let callback:string
 try{callback=weeztixCallbackUrl(request)}
 catch{return NextResponse.json({error:"oauth_not_configured"},{status:503})}
 // Platform registration belongs to UpTillDawn, not the final customer's account.
 const platformClient=process.env.UPT_WEEZTIX_OAUTH_CLIENT_ID
 const platformSecret=process.env.UPT_WEEZTIX_OAUTH_CLIENT_SECRET
 let clientId=platformClient
 if(!clientId||!platformSecret){
  try{clientId=(await getManagedIntegrationConfig(access.db,"weeztix"))?.WEEZTIX_CLIENT_ID}
  catch{return NextResponse.json({error:"connection_unavailable"},{status:503})}
 }
 if(!clientId||clientId.length<3)return NextResponse.json({error:"oauth_app_registration_required"},{status:409})
 const eventId=new URL(request.url).searchParams.get("eventId")??""
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(eventId))
  return NextResponse.json({error:"select_event_first"},{status:422})
 const {data:event,error:eventError}=await access.db.from("events").select("id").eq("id",eventId).maybeSingle()
 if(eventError)return NextResponse.json({error:"events_unavailable"},{status:503})
 if(!event)return NextResponse.json({error:"unknown_event"},{status:404})
 const raw=crypto.getRandomValues(new Uint8Array(32))
 const state=Array.from(raw,byte=>byte.toString(16).padStart(2,"0")).join("")
 const target=new URL(WEEZTIX_AUTH_BASE)
 target.searchParams.set("client_id",clientId)
 target.searchParams.set("redirect_uri",callback)
 target.searchParams.set("response_type","code")
 target.searchParams.set("state",state)
 const response=NextResponse.redirect(target.toString(),{status:303,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}})
 response.cookies.set(WEEZTIX_OAUTH_STATE_COOKIE,state+":"+access.user.id+":"+eventId,{
  httpOnly:true,secure:callback.startsWith("https:"),sameSite:"lax",maxAge:600,
  path:"/api/administration/integrations/weeztix"
 })
 return response
}
