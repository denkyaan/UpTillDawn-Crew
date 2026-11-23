// Sensitive Administration integration settings without a Next/SSR hop.
// Original admin/administration authorization is rechecked per request and
// the encrypted provider vault is written only through existing SQL RPCs.
// Never expose provider ciphertext, OAuth tokens or decrypted credentials.
import type {SupabaseClient} from "@supabase/supabase-js"
import {isIntegrationProvider,parseIntegrationConfiguration,type IntegrationProvider,type IntegrationConfiguration}
 from "../../../lib/administration/integration-credentials.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {requestHasSameOrigin} from "../../../lib/request-origin.ts"
import {sealOAuthToken,openOAuthToken,validMasterKey} from "./provider-oauth.ts"

type Db=Pick<SupabaseClient,"rpc">
type Env={UPT_INTEGRATION_ENCRYPTION_KEY?:string}
const studio=(payload:unknown,status=200)=>Response.json(payload,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
function storageFailure(code:string){return studio({error:code},503)}
async function vault(db:Db,action:"read"|"save"|"disconnect",provider:IntegrationProvider,
 ciphertext:string|null=null):Promise<{data:unknown;error:{message?:string;code?:string}|null}>{
 return db.rpc("upt_integration_credentials",{
  p_action:action,p_provider:provider,p_ciphertext:ciphertext
 })
}
function masterKey(env:Env){
 const key=env.UPT_INTEGRATION_ENCRYPTION_KEY
 if(!key||!validMasterKey(key))throw Error("integration_master_key_unavailable")
 return key
}
async function existingWeeztix(db:Db,env:Env){
 const {data,error}=await vault(db,"read","weeztix")
 if(error||!data||typeof data!=="object")throw Error("integration_storage_unavailable")
 const row=data as Record<string,unknown>
 if(row.configured===false)return null
 if(row.configured!==true||typeof row.ciphertext!=="string")throw Error("integration_storage_unavailable")
 const previous=await openOAuthToken("weeztix",row.ciphertext,masterKey(env))
 const checked=parseIntegrationConfiguration("weeztix",previous)
 if(!checked)throw Error("integration_invalid_configuration")
 return checked
}
async function save(db:Db,env:Env,value:Record<string,unknown>):Promise<Response>{
 const provider=value.provider
 if(!isIntegrationProvider(provider))return studio({error:"invalid_provider"},422)
 if(Object.keys(value).some(x=>x!=="provider"&&x!=="credentials"))
  return studio({error:"invalid_body"},400)
 // Merchant and Peppol grants are exchanged and sealed by their original
 // verified OAuth callbacks, never by a browser-supplied credential string.
 if(provider==="sumup"||provider==="peppol")
  return studio({error:"connect_via_provider_login"},409)
 if(provider==="weeztix"&&value.credentials&&typeof value.credentials==="object"&&
    !Array.isArray(value.credentials)){
  const fields=value.credentials as Record<string,unknown>
  if("WEEZTIX_REFRESH_TOKEN" in fields||"WEEZTIX_TOKEN_EXPIRES_AT" in fields)
   return studio({error:"invalid_body"},422)
 }
 try{
  const parsed=parseIntegrationConfiguration(provider,value.credentials)
  if(!parsed)return studio({error:"invalid_credentials"},422)
  let next:IntegrationConfiguration={...parsed}
  if(provider==="weeztix"&&!Object.prototype.hasOwnProperty.call(next,"WEEZTIX_REFRESH_TOKEN")){
   const previous=await existingWeeztix(db,env)
   if(previous&&previous.WEEZTIX_CLIENT_ID===next.WEEZTIX_CLIENT_ID&&
    previous.WEEZTIX_CLIENT_SECRET===next.WEEZTIX_CLIENT_SECRET&&
    previous.WEEZTIX_REFRESH_TOKEN&&previous.WEEZTIX_TOKEN_EXPIRES_AT&&
    (!next.WEEZTIX_ACCESS_TOKEN||
      next.WEEZTIX_ACCESS_TOKEN===previous.WEEZTIX_ACCESS_TOKEN)){
    next={...next,WEEZTIX_ACCESS_TOKEN:previous.WEEZTIX_ACCESS_TOKEN,
     WEEZTIX_REFRESH_TOKEN:previous.WEEZTIX_REFRESH_TOKEN,
     WEEZTIX_TOKEN_EXPIRES_AT:previous.WEEZTIX_TOKEN_EXPIRES_AT}
   }
  }
  const checked=parseIntegrationConfiguration(provider,next)
  if(!checked)return studio({error:"invalid_credentials"},422)
  const ciphertext=await sealOAuthToken(provider,checked as Record<string,string>,masterKey(env))
  const {data,error}=await vault(db,"save",provider,ciphertext)
  if(error||!data||typeof data!=="object"||
     (data as {configured?:unknown}).configured!==true)
   return storageFailure("integration_storage_unavailable")
  return studio({ok:true,configured:true})
 }catch(error){
  if(error instanceof Error&&error.message==="integration_invalid_configuration")
   return studio({error:"invalid_credentials"},422)
  if(error instanceof Error&&error.message==="integration_master_key_unavailable")
   return storageFailure("integration_master_key_unavailable")
  return storageFailure("integration_storage_unavailable")
 }
}
export async function nativeIntegrationMutation(
 db:Db,request:Request,env:Env,method:"POST"|"DELETE"
):Promise<Response>{
 // Source's strict browser-origin policy also rejects missing origin and
 // non-HTTP schemes; provider keys cannot be changed by CSRF.
 if(!requestHasSameOrigin(request))return studio({error:"forbidden"},403)
 try{
  const {data:allowed,error:accessError}=await db.rpc("upt_can_manage_integrations")
  if(accessError)return studio({error:"forbidden"},503)
  if(allowed!==true)return studio({error:"forbidden"},403)
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
   return studio({error:"invalid_body"},415)
  let body:unknown
  try{body=await readStrictJson(request,method==="POST"?10_240:512)}
  catch{return studio({error:"invalid_body"},400)}
  if(!body||typeof body!=="object"||Array.isArray(body))
   return studio({error:"invalid_body"},400)
  const value=body as Record<string,unknown>
  if(method==="POST")return save(db,env,value)
  if(!isIntegrationProvider(value.provider)||Object.keys(value).some(k=>k!=="provider"))
   return studio({error:"invalid_provider"},422)
  try{
   const {data,error}=await vault(db,"disconnect",value.provider)
   if(error||!data||typeof data!=="object"||
     (data as {configured?:unknown}).configured!==false)
    return storageFailure("integration_storage_unavailable")
   return studio({ok:true,configured:false})
  }catch{return storageFailure("integration_storage_unavailable")}
 }catch{return storageFailure("integration_storage_unavailable")}
}
