// Original Administration integrations GET, executed with the signed user's
// Supabase RLS and managed-integrations privilege. Returns ONLY redacted
// connection metadata, never OAuth keys, plaintext or ciphertext.
import type {SupabaseClient} from "@supabase/supabase-js"
import {isIntegrationProvider,parseIntegrationConfiguration}
 from "../../../lib/administration/integration-credentials.ts"
import {openIntegrationSecrets,validIntegrationMasterKey}
 from "../../../lib/administration/integration-crypto.ts"

export type NativeIntegrationReadEnv={
 UPT_INTEGRATION_ENCRYPTION_KEY?:string
 UPT_WEEZTIX_OAUTH_ORIGIN?:string
 UPT_MIGRATION_OAUTH_ENABLED?:string
}
type Db=Pick<SupabaseClient,"rpc">
const noStore={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"} as const
const json=(payload:unknown,status=200)=>Response.json(payload,{status,headers:noStore})
function weeztixCallback(request:Request,env:NativeIntegrationReadEnv):string|null{
 // Never offer a Weeztix callback on an unconfigured QA Worker. OAuth GET
 // starts and callbacks are explicitly blocked while migration writes are off.
 if(env.UPT_MIGRATION_OAUTH_ENABLED!=="true"||!env.UPT_WEEZTIX_OAUTH_ORIGIN)return null
 try{
  const url=new URL(request.url),configured=new URL(env.UPT_WEEZTIX_OAUTH_ORIGIN)
  if(configured.protocol!=="https:"||configured.origin!==url.origin||
   configured.href!==configured.origin+"/"||configured.username||configured.password)
   return null
  return configured.origin+"/api/administration/integrations/weeztix/callback"
 }catch{return null}
}
export async function nativeIntegrationsSummary(
 db:Db,request:Request,env:NativeIntegrationReadEnv
):Promise<Response>{
 try{
  const {data:allowed,error:accessError}=await db.rpc("upt_can_manage_integrations")
  if(accessError)return json({error:"forbidden"},503)
  if(allowed!==true)return json({error:"forbidden"},403)
  const [listResult,auditResult,weeztixResult]=await Promise.all([
   db.rpc("upt_integration_credentials",{p_action:"list",p_provider:null,p_ciphertext:null}),
   db.rpc("upt_integration_audit_recent",{p_limit:15}),
   db.rpc("upt_integration_credentials",{p_action:"read",p_provider:"weeztix",p_ciphertext:null})
  ])
  if(listResult.error||!Array.isArray(listResult.data)||listResult.data.length>100||
   auditResult.error||!Array.isArray(auditResult.data)||auditResult.data.length>15||
   weeztixResult.error)throw Error("integration_storage_unavailable")
  const integrations=listResult.data.map(value=>{
   if(!value||typeof value!=="object")throw Error("invalid_summary")
   const item=value as Record<string,unknown>
   if(!isIntegrationProvider(item.provider)||typeof item.updated_at!=="string")
    throw Error("invalid_summary")
   return {provider:item.provider,updated_at:item.updated_at,
    updated_by:typeof item.updated_by==="string"?item.updated_by:null}
  })
  const audit=auditResult.data.map(value=>{
   if(!value||typeof value!=="object")throw Error("invalid_audit")
   const item=value as Record<string,unknown>
   if(!isIntegrationProvider(item.provider)||
      !["connected","updated","disconnected"].includes(String(item.action))||
      typeof item.actor_name!=="string"||typeof item.occurred_at!=="string")
    throw Error("invalid_audit")
   return {provider:item.provider,action:item.action,
    actor_name:item.actor_name,occurred_at:item.occurred_at}
  })
  let weeztixOauthReady=false
  const row=weeztixResult.data as Record<string,unknown>|null
  if(!row||typeof row!=="object"||Array.isArray(row))throw Error("invalid_weeztix")
  if(row.configured===true){
   if(typeof row.ciphertext!=="string"||!validIntegrationMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))
    throw Error("integration_storage_unavailable")
   const decoded=await openIntegrationSecrets("weeztix",row.ciphertext,env.UPT_INTEGRATION_ENCRYPTION_KEY!)
   const config=parseIntegrationConfiguration("weeztix",decoded)
   if(!config)throw Error("invalid_weeztix_config")
   weeztixOauthReady=Boolean(config.WEEZTIX_CLIENT_ID&&config.WEEZTIX_CLIENT_SECRET)
  }else if(row.configured!==false)throw Error("invalid_weeztix")
  return json({
   integrations,audit,weeztixOauthReady,
   weeztixOauthCallbackUrl:weeztixCallback(request,env),
   secureStoreAvailable:validIntegrationMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY)
  })
 }catch{return json({error:"integration_storage_unavailable"},503)}
}
