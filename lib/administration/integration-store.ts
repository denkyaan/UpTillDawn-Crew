import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {isIntegrationProvider,integrationProviders,parseIntegrationConfiguration,type IntegrationProvider,type IntegrationSummary,type IntegrationConfiguration} from "@/lib/administration/integration-credentials"
import {sealIntegrationSecrets,openIntegrationSecrets,validIntegrationMasterKey} from "@/lib/administration/integration-crypto"

type Db=Awaited<ReturnType<typeof createClient>>
type RpcResponse={data:unknown;error:{message?:string;code?:string}|null}
function rpc(db:Db,action:"list"|"read"|"save"|"disconnect",provider:IntegrationProvider|null=null,ciphertext:string|null=null):Promise<RpcResponse>{
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:{p_action:string;p_provider:string|null;p_ciphertext:string|null})=>Promise<RpcResponse>
 return invoke("upt_integration_credentials",{p_action:action,p_provider:provider,p_ciphertext:ciphertext})
}
function masterKey():string{
 const value=process.env.UPT_INTEGRATION_ENCRYPTION_KEY
 if(typeof value!=="string"||!validIntegrationMasterKey(value))throw Error("integration_master_key_unavailable")
 return value
}
/** Read metadata only; no ciphertext or secret values are returned to the browser. */
export async function listIntegrationSummaries(db:Db):Promise<IntegrationSummary[]>{
 const {data,error}=await rpc(db,"list")
 if(error||!Array.isArray(data))throw Error("integration_storage_unavailable")
 const rows:IntegrationSummary[]=[]
 for(const value of data){
  if(!value||typeof value!=="object")throw Error("integration_storage_unavailable")
  const row=value as Record<string,unknown>
  if(!isIntegrationProvider(row.provider)||typeof row.updated_at!=="string")throw Error("integration_storage_unavailable")
  rows.push({provider:row.provider,updated_at:row.updated_at,updated_by:typeof row.updated_by==="string"?row.updated_by:null})
 }
 return rows
}
export async function saveIntegrationCredentials(db:Db,provider:IntegrationProvider,fields:unknown):Promise<void>{
 const parsed=parseIntegrationConfiguration(provider,fields)
 if(!parsed)throw Error("integration_invalid_configuration")
 let next={...parsed}
 // Preserve an OAuth token for the same Weeztix Client when editing event
 // settings. Replacing the manual token/client revokes the old refresh pair.
 if(provider==="weeztix"&&!Object.prototype.hasOwnProperty.call(next,"WEEZTIX_REFRESH_TOKEN")){
  const previous=await getManagedIntegrationConfig(db,"weeztix")
  if(previous&&previous.WEEZTIX_CLIENT_ID===next.WEEZTIX_CLIENT_ID&&
     previous.WEEZTIX_CLIENT_SECRET===next.WEEZTIX_CLIENT_SECRET&&
     previous.WEEZTIX_REFRESH_TOKEN&&previous.WEEZTIX_TOKEN_EXPIRES_AT&&
     (!next.WEEZTIX_ACCESS_TOKEN||next.WEEZTIX_ACCESS_TOKEN===previous.WEEZTIX_ACCESS_TOKEN)){
    next={...next,WEEZTIX_ACCESS_TOKEN:previous.WEEZTIX_ACCESS_TOKEN,
     WEEZTIX_REFRESH_TOKEN:previous.WEEZTIX_REFRESH_TOKEN,
     WEEZTIX_TOKEN_EXPIRES_AT:previous.WEEZTIX_TOKEN_EXPIRES_AT}
  }
 }
 const validated=parseIntegrationConfiguration(provider,next)
 if(!validated)throw Error("integration_invalid_configuration")
 const cipher=await sealIntegrationSecrets(provider,validated as Record<string,string>,masterKey())
 const {error,data}=await rpc(db,"save",provider,cipher)
 if(error||!data||typeof data!=="object"||(data as {configured?:unknown}).configured!==true)throw Error("integration_storage_unavailable")
}
export async function disconnectIntegration(db:Db,provider:IntegrationProvider):Promise<void>{
 const {error,data}=await rpc(db,"disconnect",provider)
 if(error||!data||typeof data!=="object"||(data as {configured?:unknown}).configured!==false)throw Error("integration_storage_unavailable")
}
/** Internal-only: decrypted values cannot be exposed by any API route. */
export async function getManagedIntegrationConfig(db:Db,provider:IntegrationProvider):Promise<IntegrationConfiguration|null>{
 const {data,error}=await rpc(db,"read",provider)
 if(error)throw Error("integration_storage_unavailable")
 if(!data||typeof data!=="object")throw Error("integration_storage_unavailable")
 const row=data as Record<string,unknown>
 if(row.configured===false)return null
 if(row.configured!==true||typeof row.ciphertext!=="string")throw Error("integration_storage_unavailable")
 const decrypted=await openIntegrationSecrets(provider,row.ciphertext,masterKey())
 const validated=parseIntegrationConfiguration(provider,decrypted)
 if(!validated)throw Error("integration_invalid_configuration")
 return validated
}
export function managedProviderIds():readonly IntegrationProvider[]{return integrationProviders}

/** Metadata-only administration audit; includes no ciphertext or raw provider values. */
export type IntegrationAuditEvent={
 provider:IntegrationProvider
 action:"connected"|"updated"|"disconnected"
 actor_name:string
 occurred_at:string
}
export async function listRecentIntegrationAudit(db:Db):Promise<IntegrationAuditEvent[]>{
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:{p_limit:number})=>Promise<RpcResponse>
 const {data,error}=await invoke("upt_integration_audit_recent",{p_limit:15})
 if(error||!Array.isArray(data))throw Error("integration_audit_unavailable")
 const audit:IntegrationAuditEvent[]=[]
 for(const value of data){
  if(!value||typeof value!=="object")throw Error("integration_audit_unavailable")
  const row=value as Record<string,unknown>
  if(!isIntegrationProvider(row.provider)||
     (row.action!=="connected"&&row.action!=="updated"&&row.action!=="disconnected")||
     typeof row.actor_name!=="string"||typeof row.occurred_at!=="string")
     throw Error("integration_audit_unavailable")
  audit.push({provider:row.provider,action:row.action,actor_name:row.actor_name,occurred_at:row.occurred_at})
 }
 return audit
}

/**
 * Only call after the existing scan route has independently validated the
 * operator's authenticated event/workplace. The database repeats those checks,
 * including role assignment, and returns ciphertext to the Worker only.
 */
export type ScopedWeeztixConnection={config:IntegrationConfiguration;ciphertext:string}
export async function getScopedWeeztixConnection(db:Db,eventId:string,workplaceId:string):Promise<ScopedWeeztixConnection|null>{
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:{p_event_id:string;p_workplace_id:string})=>Promise<RpcResponse>
 const {data,error}=await invoke("upt_weeztix_scan_secrets",{p_event_id:eventId,p_workplace_id:workplaceId})
 if(error)throw Error("weeztix_credentials_forbidden")
 if(!data||typeof data!=="object")throw Error("weeztix_credentials_unavailable")
 const row=data as Record<string,unknown>
 if(row.configured===false)return null
 if(row.configured!==true||typeof row.ciphertext!=="string")throw Error("weeztix_credentials_unavailable")
 const decoded=await openIntegrationSecrets("weeztix",row.ciphertext,masterKey())
 const checked=parseIntegrationConfiguration("weeztix",decoded)
 if(!checked)throw Error("weeztix_credentials_unavailable")
 return {config:checked,ciphertext:row.ciphertext}
}
export async function getScopedWeeztixScanConfig(db:Db,eventId:string,workplaceId:string):Promise<IntegrationConfiguration|null>{
 return (await getScopedWeeztixConnection(db,eventId,workplaceId))?.config??null
}
export async function claimScopedWeeztixRefresh(db:Db,eventId:string,workplaceId:string):Promise<string|null>{
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:Record<string,string>)=>Promise<RpcResponse>
 const {data,error}=await invoke("upt_weeztix_claim_refresh",{p_event_id:eventId,p_workplace_id:workplaceId})
 if(error)throw Error("weeztix_refresh_unavailable")
 return typeof data==="string"&&/^[0-9a-f-]{36}$/i.test(data)?data:null
}
export async function commitScopedWeeztixRefresh(db:Db,eventId:string,workplaceId:string,claimId:string,previousCiphertext:string,newConfig:IntegrationConfiguration):Promise<boolean>{
 const checked=parseIntegrationConfiguration("weeztix",newConfig)
 if(!checked)throw Error("weeztix_invalid_rotation")
 const ciphertext=await sealIntegrationSecrets("weeztix",checked as Record<string,string>,masterKey())
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:Record<string,string>)=>Promise<RpcResponse>
 const {data,error}=await invoke("upt_weeztix_commit_refresh",{
  p_event_id:eventId,p_workplace_id:workplaceId,p_claim_id:claimId,
  p_previous_ciphertext:previousCiphertext,p_new_ciphertext:ciphertext
 })
 if(error)throw Error("weeztix_refresh_unavailable")
 return data===true
}
export async function releaseScopedWeeztixRefresh(db:Db,eventId:string,workplaceId:string,claimId:string):Promise<void>{
 const invoke=db.rpc.bind(db) as unknown as (name:string,args:Record<string,string>)=>Promise<RpcResponse>
 await invoke("upt_weeztix_release_refresh",{p_event_id:eventId,p_workplace_id:workplaceId,p_claim_id:claimId})
}


/** Report OAuth readiness only, never OAuth client credentials. */
export async function weeztixOAuthReadiness(db:Db):Promise<boolean>{
 const settings=await getManagedIntegrationConfig(db,"weeztix")
 return Boolean(settings?.WEEZTIX_CLIENT_ID&&settings.WEEZTIX_CLIENT_SECRET)
}
