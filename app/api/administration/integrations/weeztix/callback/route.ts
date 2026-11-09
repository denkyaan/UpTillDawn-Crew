import {NextRequest,NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {getManagedIntegrationConfig,saveIntegrationCredentials} from "@/lib/administration/integration-store"
import {requestWeeztixOAuthTokens,WEEZTIX_OAUTH_STATE_COOKIE,weeztixCallbackUrl} from "@/lib/administration/weeztix-oauth"

export const dynamic="force-dynamic"
const SETTINGS="/portals/administration/modules/settings"
function sameState(expected:string,received:string):boolean{
 if(expected.length!==64||received.length!==64)return false
 let diff=0
 for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^received.charCodeAt(i)
 return diff===0
}
function outcome(request:NextRequest,status:"connected"|"denied"|"expired"|"failed"){
 // Only fixed internal target and small allowlisted statuses.
 const url=new URL(SETTINGS,request.url)
 url.searchParams.set("weeztix_oauth",status)
 const response=NextResponse.redirect(url,{status:303,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}})
 response.cookies.set(WEEZTIX_OAUTH_STATE_COOKIE,"",{httpOnly:true,secure:url.protocol==="https:",sameSite:"lax",maxAge:0,path:"/api/administration/integrations/weeztix"})
 return response
}
export async function GET(request:NextRequest){
 const access=await integrationManagementAccess()
 if(!access.ok)return NextResponse.json({error:"forbidden"},{status:access.status,headers:{"Cache-Control":"no-store"}})
 let redirectUri:string
 try{redirectUri=weeztixCallbackUrl(request)}
 catch{return outcome(request,"failed")}
 const expected=request.cookies.get(WEEZTIX_OAUTH_STATE_COOKIE)?.value||""
 const sep=expected.indexOf(":")
 if(sep<0||expected.slice(sep+1)!==access.user.id)return outcome(request,"expired")
 const state=request.nextUrl.searchParams.get("state")||""
 const code=request.nextUrl.searchParams.get("code")||""
 if(!sameState(expected.slice(0,sep),state))return outcome(request,"expired")
 if(request.nextUrl.searchParams.has("error"))return outcome(request,"denied")
 if(code.length<6||code.length>2048||/[\u0000-\u001f\u007f]/.test(code))return outcome(request,"failed")
 let config
 try{config=await getManagedIntegrationConfig(access.db,"weeztix")}
 catch{return outcome(request,"failed")}
 if(!config?.WEEZTIX_CLIENT_ID||!config.WEEZTIX_CLIENT_SECRET)return outcome(request,"failed")
 const tokens=await requestWeeztixOAuthTokens({
  grant_type:"authorization_code",
  client_id:config.WEEZTIX_CLIENT_ID,
  client_secret:config.WEEZTIX_CLIENT_SECRET,
  redirect_uri:redirectUri,
  code
 })
 if(!tokens)return outcome(request,"failed")
 try{
  await saveIntegrationCredentials(access.db,"weeztix",{...config,...tokens})
 }catch{return outcome(request,"failed")}
 return outcome(request,"connected")
}
