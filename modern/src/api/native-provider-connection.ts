// Read-only connection diagnostics with application-encrypted credentials.
// Delegated SumUp/Billit grants are refreshed server-side at the fixed vendor
// token endpoint; a revoked grant is never disguised as connected.
import type {SupabaseClient} from "@supabase/supabase-js"
import {parseIntegrationConfiguration} from "../../../lib/administration/integration-credentials.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {requestHasSameOrigin} from "../../../lib/request-origin.ts"
import {openOAuthToken,sealOAuthToken,validMasterKey} from "./provider-oauth.ts"
import {checkProviderConnection,type ConnectionProvider} from "./native-provider-probes.ts"

type Db=Pick<SupabaseClient,"rpc">
type Env={UPT_INTEGRATION_ENCRYPTION_KEY?:string;
 UPT_SUMUP_OAUTH_CLIENT_ID?:string;UPT_SUMUP_OAUTH_CLIENT_SECRET?:string;
 UPT_BILLIT_OAUTH_CLIENT_ID?:string;UPT_BILLIT_OAUTH_CLIENT_SECRET?:string;
 UPT_BILLIT_OAUTH_ENV?:string}
const noStore={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"} as const
const fail=(error:string,status:number)=>Response.json({status:"unavailable",error},{status,headers:noStore})
const vendors=["sumup","documenso","banking","peppol"] as const
function isConnectionProvider(x:unknown):x is ConnectionProvider{
 return typeof x==="string"&&vendors.some(y=>y===x)
}
const providerKeys={
 sumup:{client:"UPT_SUMUP_OAUTH_CLIENT_ID",secret:"UPT_SUMUP_OAUTH_CLIENT_SECRET"},
 peppol:{client:"UPT_BILLIT_OAUTH_CLIENT_ID",secret:"UPT_BILLIT_OAUTH_CLIENT_SECRET"}
} as const
function prefix(provider:"sumup"|"peppol"){return provider==="sumup"?"SUMUP":"BILLIT"}
async function limitedJson(response:Response){
 if(!response.ok||!response.body)return null
 const advertised=response.headers.get("content-length")
 if(advertised&&(!/^\d+$/.test(advertised)||Number(advertised)>16_000))return null
 const reader=response.body.getReader(),chunks:Uint8Array[]=[]
 let total=0
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>16_000){await reader.cancel().catch(()=>{});return null}
   chunks.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let pos=0
 for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown}
 catch{return null}
}
async function refreshProvider(provider:"sumup"|"peppol",stored:Record<string,string>,env:Env){
 const p=prefix(provider),refresh=stored[p+"_OAUTH_REFRESH_TOKEN"]
 const entry=providerKeys[provider],client=env[entry.client],secret=env[entry.secret]
 if(!client?.trim()||!secret?.trim()||!refresh||refresh.length<10||refresh.length>4096||
  /[\u0000-\u001f\u007f]/.test(refresh))
  throw Error("oauth_reauthorization_required")
 const originalEnv=stored.BILLIT_OAUTH_ENV
 const target=provider==="sumup"?"https://api.sumup.com/token":
  originalEnv==="production"?"https://api.billit.be/OAuth2/token":
   "https://api.sandbox.billit.be/OAuth2/token"
 const body={grant_type:"refresh_token",refresh_token:refresh,client_id:client,client_secret:secret}
 let result:unknown
 try{
  const response=await fetch(target,{
   method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000),
   headers:{"Accept":"application/json","Content-Type":provider==="sumup"?
    "application/x-www-form-urlencoded":"application/json"},
   body:provider==="sumup"?new URLSearchParams(body).toString():JSON.stringify(body)
  })
  result=await limitedJson(response)
 }catch{throw Error("oauth_reauthorization_required")}
 if(!result||typeof result!=="object"||Array.isArray(result))
  throw Error("oauth_reauthorization_required")
 const token=result as Record<string,unknown>
 const access=token.access_token,newRefresh=token.refresh_token??refresh,expires=token.expires_in
 if(token.token_type!==undefined&&String(token.token_type).toLowerCase()!=="bearer"||
    typeof access!=="string"||access.length<10||access.length>4096||
    typeof newRefresh!=="string"||newRefresh.length<10||newRefresh.length>4096||
    /[\u0000-\u001f\u007f]/.test(access+newRefresh)||
    typeof expires!=="number"||!Number.isSafeInteger(expires)||expires<60||expires>31_536_000)
  throw Error("oauth_reauthorization_required")
 const updated:Record<string,string>={
  [p+"_OAUTH_ACCESS_TOKEN"]:access,
  [p+"_OAUTH_REFRESH_TOKEN"]:newRefresh,
  [p+"_OAUTH_EXPIRES_AT"]:String(Math.floor(Date.now()/1000)+expires-30)
 }
 if(provider==="peppol"){
  // The stored company consent environment must not silently switch.
  if(!["sandbox","production"].includes(originalEnv||""))
   throw Error("oauth_environment_changed")
  updated.BILLIT_OAUTH_ENV=originalEnv!
 }
 const valid=parseIntegrationConfiguration(provider,updated)
 if(!valid)throw Error("oauth_reauthorization_required")
 return valid
}
async function configuration(db:Db,provider:ConnectionProvider,env:Env){
 const {data,error}=await db.rpc("upt_integration_credentials",{
  p_action:"read",p_provider:provider,p_ciphertext:null
 })
 if(error||!data||typeof data!=="object"||Array.isArray(data))
  throw Error("integration_storage_unavailable")
 const row=data as Record<string,unknown>
 if(row.configured===false)return null
 if(row.configured!==true||typeof row.ciphertext!=="string"||
  !validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))
  throw Error("integration_storage_unavailable")
 const restored=await openOAuthToken(provider,row.ciphertext,env.UPT_INTEGRATION_ENCRYPTION_KEY!)
 const checked=parseIntegrationConfiguration(provider,restored)
 if(!checked)throw Error("integration_storage_unavailable")
 if(provider==="sumup"||provider==="peppol"){
  const p=prefix(provider),access=checked[p+"_OAUTH_ACCESS_TOKEN"]
  if(access){
   const expiry=Number(checked[p+"_OAUTH_EXPIRES_AT"])
   if(!Number.isSafeInteger(expiry))throw Error("oauth_reauthorization_required")
   if(expiry<=Date.now()/1000+120){
    const changed=await refreshProvider(provider,checked,env)
    // The existing SQL vault audits the delegated refresh as a server-only
    // connection update; browser never receives the tokens or ciphertext.
    const ciphertext=await sealOAuthToken(provider,changed as Record<string,string>,
     env.UPT_INTEGRATION_ENCRYPTION_KEY!)
    const saved=await db.rpc("upt_integration_credentials",{
     p_action:"save",p_provider:provider,p_ciphertext:ciphertext
    })
    if(saved.error||!saved.data||typeof saved.data!=="object"||
       (saved.data as {configured?:unknown}).configured!==true)
     throw Error("integration_storage_unavailable")
    return changed
   }
  }
 }
 return checked
}
export async function nativeProviderConnectionCheck(
 db:Db,request:Request,env:Env
):Promise<Response>{
 if(!requestHasSameOrigin(request))return fail("forbidden",403)
 try{
  const {data:allowed,error}=await db.rpc("upt_can_manage_integrations")
  if(error)return fail("authorization_unavailable",503)
  if(allowed!==true)return fail("forbidden",403)
 }catch{return fail("authorization_unavailable",503)}
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return fail("unsupported",415)
 let value:unknown
 try{value=await readStrictJson(request,256)}catch(error){
  return fail("invalid_request",error instanceof Error&&error.message==="too_large"?413:400)
 }
 if(!value||typeof value!=="object"||Array.isArray(value))
  return fail("invalid_request",400)
 const object=value as Record<string,unknown>
 if(!isConnectionProvider(object.provider)||Object.keys(object).some(x=>x!=="provider"))
  return fail("invalid_provider",422)
 const provider=object.provider
 let managed:Record<string,string>|null=null
 try{managed=await configuration(db,provider,env)}
 catch(error){
  if(error instanceof Error&&(
   error.message==="oauth_reauthorization_required"||error.message==="oauth_environment_changed"))
   return fail("provider_reauthorization_required",409)
  return fail("integration_storage_unavailable",503)
 }
 const result=await checkProviderConnection(provider,managed||{})
 return Response.json({status:result,
  scope:provider==="banking"?"bank_accounts_read_only":"credentials_only"
 },{headers:noStore})
}
