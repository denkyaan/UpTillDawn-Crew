import {NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {isIntegrationProvider} from "@/lib/administration/integration-credentials"
import {disconnectIntegration,listIntegrationSummaries,listRecentIntegrationAudit,weeztixOAuthReadiness,saveIntegrationCredentials} from "@/lib/administration/integration-store"
import {validIntegrationMasterKey} from "@/lib/administration/integration-crypto"
import {weeztixCallbackUrl} from "@/lib/administration/weeztix-oauth"

export const dynamic="force-dynamic"
const headers={"Cache-Control":"no-store"}
const output=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers})
async function smallJson(request:Request,limit:number):Promise<unknown>{
 const reader=request.body?.getReader()
 if(!reader)throw Error("invalid_body")
 const chunks:Uint8Array[]=[]
 let size=0
 while(true){
  const next=await reader.read()
  if(next.done)break
  size+=next.value.byteLength
  if(size>limit){await reader.cancel().catch(()=>{});throw Error("invalid_body")}
  chunks.push(next.value)
 }
 const bytes=new Uint8Array(size);let index=0
 for(const chunk of chunks){bytes.set(chunk,index);index+=chunk.byteLength}
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)) as unknown
}
async function authorized(){
 const access=await integrationManagementAccess()
 return access
}
export async function GET(request:Request){
 const access=await authorized()
 if(!access.ok)return output({error:"forbidden"},access.status)
 try{
  const [integrations,audit,weeztixOauthReady]=await Promise.all([
   listIntegrationSummaries(access.db),listRecentIntegrationAudit(access.db),weeztixOAuthReadiness(access.db)
  ])
  let weeztixOauthCallbackUrl:string|null=null
  try{weeztixOauthCallbackUrl=weeztixCallbackUrl(request)}catch{/* Fail closed on unconfigured domains. */}
  return output({integrations,audit,weeztixOauthReady,weeztixOauthCallbackUrl,
   secureStoreAvailable:validIntegrationMasterKey(process.env.UPT_INTEGRATION_ENCRYPTION_KEY)})
 }catch{return output({error:"integration_storage_unavailable"},503)}
}
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return output({error:"forbidden"},403)
 const access=await authorized()
 if(!access.ok)return output({error:"forbidden"},access.status)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return output({error:"invalid_body"},415)
 let body:unknown
 try{body=await smallJson(request,10240)}catch{return output({error:"invalid_body"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return output({error:"invalid_body"},400)
 const value=body as Record<string,unknown>
 if(!isIntegrationProvider(value.provider))return output({error:"invalid_provider"},422)
 if(Object.keys(value).some(k=>k!=="provider"&&k!=="credentials"))return output({error:"invalid_body"},400)
 // OAuth refresh values are created and rotated server-side only, never
 // accepted from an arbitrary browser POST.
 if(value.provider==="weeztix"&&value.credentials&&typeof value.credentials==="object"&&!Array.isArray(value.credentials)){
  const fields=value.credentials as Record<string,unknown>
  if("WEEZTIX_REFRESH_TOKEN" in fields||"WEEZTIX_TOKEN_EXPIRES_AT" in fields)
   return output({error:"invalid_body"},422)
 }
 try{
  await saveIntegrationCredentials(access.db,value.provider,value.credentials)
  return output({ok:true,configured:true})
 }catch(error){
  if(error instanceof Error&&error.message==="integration_invalid_configuration")return output({error:"invalid_credentials"},422)
  if(error instanceof Error&&error.message==="integration_master_key_unavailable")return output({error:"integration_master_key_unavailable"},503)
  return output({error:"integration_storage_unavailable"},503)
 }
}
export async function DELETE(request:Request){
 if(!requestHasSameOrigin(request))return output({error:"forbidden"},403)
 const access=await authorized()
 if(!access.ok)return output({error:"forbidden"},access.status)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return output({error:"invalid_body"},415)
 let body:unknown
 try{body=await smallJson(request,512)}catch{return output({error:"invalid_body"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return output({error:"invalid_body"},400)
 const value=body as Record<string,unknown>
 if(!isIntegrationProvider(value.provider)||Object.keys(value).some(k=>k!=="provider"))return output({error:"invalid_provider"},422)
 try{
  await disconnectIntegration(access.db,value.provider)
  return output({ok:true,configured:false})
 }catch{return output({error:"integration_storage_unavailable"},503)}
}
