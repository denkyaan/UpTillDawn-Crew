import {NextRequest,NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {userOAuthCallbackUrl,userOAuthConsentUrl,userOAuthCookie,userOAuthReady,oauthRandomState,type UserOAuthProvider} from "@/lib/administration/provider-user-oauth"
import {validIntegrationMasterKey} from "@/lib/administration/integration-crypto"

export const dynamic="force-dynamic"
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}
function fail(code:string,status:number){return NextResponse.json({error:code},{status,headers})}
export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const {provider}=await params
 if(provider!=="sumup"&&provider!=="peppol")return fail("unsupported_provider",404)
 const access=await integrationManagementAccess()
 if(!access.ok)return fail("forbidden",access.status)
 if(!validIntegrationMasterKey(process.env.UPT_INTEGRATION_ENCRYPTION_KEY))
  return fail("integration_storage_not_configured",503)
 if(!userOAuthReady(provider))return fail("provider_app_registration_required",409)
 let callback:string,target:string
 const state=oauthRandomState()
 try{
  callback=userOAuthCallbackUrl(request,provider)
  target=userOAuthConsentUrl(provider,callback,state)
 }catch{return fail("provider_callback_not_configured",503)}
 const response=NextResponse.redirect(target,{status:303,headers})
 response.cookies.set(userOAuthCookie(provider),state+":"+access.user.id,{
  path:"/api/administration/integrations/oauth/"+provider,
  httpOnly:true,secure:callback.startsWith("https:"),sameSite:"lax",maxAge:600
 })
 return response
}
