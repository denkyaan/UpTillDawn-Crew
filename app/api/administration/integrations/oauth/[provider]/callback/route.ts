import {NextRequest,NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {saveIntegrationCredentials} from "@/lib/administration/integration-store"
import {exchangeUserOAuthCode,oauthStoredConfiguration,userOAuthCallbackUrl,userOAuthCookie,verifyOAuthState,type UserOAuthProvider} from "@/lib/administration/provider-user-oauth"

export const dynamic="force-dynamic"
const paths={sumup:"/portals/administration/modules/banking",peppol:"/portals/administration/modules/invoices"}
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}
function finish(request:NextRequest,provider:UserOAuthProvider,result:"authorized"|"denied"|"expired"|"failed"){
 const target=new URL(paths[provider],request.url)
 target.searchParams.set(provider+"_oauth",result)
 const response=NextResponse.redirect(target,{status:303,headers})
 response.cookies.set(userOAuthCookie(provider),"",{
  httpOnly:true,secure:target.protocol==="https:",sameSite:"lax",
  maxAge:0,path:"/api/administration/integrations/oauth/"+provider
 })
 return response
}
export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params
 if(provider!=="sumup"&&provider!=="peppol")
  return NextResponse.json({error:"unsupported_provider"},{status:404,headers})
 const access=await integrationManagementAccess()
 if(!access.ok)return NextResponse.json({error:"forbidden"},{status:access.status,headers})
 let callback:string
 try{callback=userOAuthCallbackUrl(request,provider)}
 catch{return finish(request,provider,"failed")}
 const stored=request.cookies.get(userOAuthCookie(provider))?.value??""
 const sep=stored.indexOf(":")
 const state=request.nextUrl.searchParams.get("state")??""
 if(sep!==64||stored.slice(sep+1)!==access.user.id||
    !verifyOAuthState(stored.slice(0,sep),state))return finish(request,provider,"expired")
 if(request.nextUrl.searchParams.has("error"))return finish(request,provider,"denied")
 const code=request.nextUrl.searchParams.get("code")??""
 const tokens=await exchangeUserOAuthCode(provider,code,callback)
 if(!tokens)return finish(request,provider,"failed")
 try{
  await saveIntegrationCredentials(access.db,provider,oauthStoredConfiguration(provider,tokens))
 }catch{return finish(request,provider,"failed")}
 return finish(request,provider,"authorized")
}
