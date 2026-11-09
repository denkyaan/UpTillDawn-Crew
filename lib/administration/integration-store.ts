import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {isIntegrationProvider,integrationProviders,parseIntegrationConfiguration,type IntegrationProvider,type IntegrationSummary,type IntegrationConfiguration} from "@/lib/administration/integration-credentials"
import {sealIntegrationSecrets,openIntegrationSecrets} from "@/lib/administration/integration-crypto"

type Db=Awaited<ReturnType<typeof createClient>>
type RpcResponse={data:unknown;error:{message?:string;code?:string}|null}
function rpc(db:Db,action:"list"|"read"|"save"|"disconnect",provider:IntegrationProvider|null=null,ciphertext:string|null=null):Promise<RpcResponse>{
 const invoke=db.rpc as unknown as (name:string,args:{p_action:string;p_provider:string|null;p_ciphertext:string|null})=>Promise<RpcResponse>
 return invoke("upt_integration_credentials",{p_action:action,p_provider:provider,p_ciphertext:ciphertext})
}
function masterKey():string{
 const value=process.env.UPT_INTEGRATION_ENCRYPTION_KEY
 if(!value)throw Error("integration_master_key_unavailable")
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
 const cipher=await sealIntegrationSecrets(provider,parsed as Record<string,string>,masterKey())
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
