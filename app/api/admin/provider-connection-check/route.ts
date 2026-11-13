import {NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {checkProviderConnection,type ConnectionProvider} from "@/lib/administration/provider-connection-check"
import {getManagedIntegrationConfig} from "@/lib/administration/integration-store"

export const dynamic="force-dynamic"
const fail=(error:string,status:number)=>NextResponse.json({status:"unavailable",error},{status,headers:{"Cache-Control":"no-store"}})
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return fail("forbidden",403)
 // Use the same verified portal permissions as Administration screens,
 // including revocation and blocking checks. Never trust client role claims.
 const access=await integrationManagementAccess()
 if(!access.ok)return fail(access.status===401?"unauthorized":access.status===403?"forbidden":"authorization_unavailable",access.status)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return fail("unsupported",415)
 // Only accept a tiny allowlisted request body, never raw credentials or URLs.
 const reader=request.body?.getReader()
 if(!reader)return fail("invalid_request",400)
 let size=0;const chunks:Uint8Array[]=[]
 try{
  while(true){
   const part=await reader.read();if(part.done)break
   size+=part.value.byteLength
   if(size>256){await reader.cancel().catch(()=>{});return fail("invalid_request",413)}
   chunks.push(part.value)
  }
 }catch{return fail("invalid_request",400)}
 const buffer=new Uint8Array(size);let off=0
 for(const chunk of chunks){buffer.set(chunk,off);off+=chunk.byteLength}
 let input:unknown
 try{input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer))}catch{return fail("invalid_request",400)}
 if(!input||typeof input!=="object"||Array.isArray(input))return fail("invalid_request",400)
 const value=(input as {provider?:unknown}).provider
 if(value!=="sumup"&&value!=="documenso"&&value!=="banking"&&value!=="peppol")return fail("invalid_provider",422)
 // Prefer the encrypted application-managed credentials over any legacy
 // Worker bindings. Never return stored values or provider response bodies.
 let environment:NodeJS.ProcessEnv=process.env
 try{
  const managed=await getManagedIntegrationConfig(access.db,value as ConnectionProvider)
  if(managed)environment={...process.env,...managed}
 }catch{return fail("integration_storage_unavailable",503)}
 const status=await checkProviderConnection(value as ConnectionProvider,environment)
 // Even a successful credential check is not a completed integration.
 return NextResponse.json({status,scope:value==="banking"?"bank_accounts_read_only":"credentials_only"},{headers:{"Cache-Control":"no-store"}})
}
