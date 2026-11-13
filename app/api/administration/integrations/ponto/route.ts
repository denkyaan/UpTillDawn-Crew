import {NextResponse} from "next/server"
import {integrationManagementAccess} from "@/lib/administration/integration-management-access"
import {getManagedIntegrationConfig} from "@/lib/administration/integration-store"
import {requestHasSameOrigin} from "@/lib/request-origin"
import {pontoAccessToken,pontoAuthorizedAccounts,pontoBookedPage} from "@/lib/administration/ponto-readonly"

export const dynamic="force-dynamic"
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers})
type Access=Extract<Awaited<ReturnType<typeof integrationManagementAccess>>,{ok:true}>
async function connection(access:Access){
 // This authenticated, encrypted configuration is the only connector source.
 const managed=await getManagedIntegrationConfig(access.db,"banking")
 if(!managed)throw Error("ponto_not_configured")
 return {token:await pontoAccessToken(managed),access}
}
function failed(error:unknown){
 const message=error instanceof Error?error.message:"ponto_unavailable"
 if(message==="ponto_not_configured")return reply({error:message},409)
 if(message==="ponto_unauthorized")return reply({error:message},401)
 if(message==="ponto_invalid_request")return reply({error:message},422)
 if(message==="ponto_invalid_accounts"||message==="ponto_invalid_content"||message==="ponto_response_too_large"||
   message==="invalid_ponto_response"||message.startsWith("invalid_ponto_")||message==="unsupported_ponto_currency")
  return reply({error:"ponto_data_incompatible"},422)
 return reply({error:"ponto_unavailable"},503)
}
/** List account choices, not balances or transactions. */
export async function GET(){
 const access=await integrationManagementAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 try{
  const {token}=await connection(access)
  const accounts=await pontoAuthorizedAccounts(token)
  return reply({accounts:accounts.map(id=>({id}))})
 }catch(error){return failed(error)}
}
/** Manual read-only pull of 100 booked provider transactions into the existing
 * pending bank register. NEVER posts invoice payments or initiates money transfer.
 */
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return reply({error:"forbidden"},403)
 const access=await integrationManagementAccess()
 if(!access.ok)return reply({error:"access_denied"},access.status)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return reply({error:"invalid_request"},415)
 let body:unknown
 try{
  const reader=request.body?.getReader()
  if(!reader)return reply({error:"invalid_request"},400)
  let n=0;const chunks:Uint8Array[]=[]
  try{
   while(true){
    const {done,value}=await reader.read()
    if(done)break
    n+=value.byteLength
    if(n>256){await reader.cancel().catch(()=>{});return reply({error:"invalid_request"},413)}
    chunks.push(value)
   }
  }finally{reader.releaseLock()}
  const data=new Uint8Array(n);let offset=0
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength}
  body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(data))
 }catch{return reply({error:"invalid_request"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"invalid_request"},422)
 const data=body as Record<string,unknown>
 if(Object.keys(data).some(key=>key!=="accountId"&&key!=="after")||
   typeof data.accountId!=="string"||!uuid.test(data.accountId)||
   (data.after!==null&&data.after!==undefined&&(typeof data.after!=="string"||!uuid.test(data.after))))
  return reply({error:"invalid_request"},422)
 try{
  const {token}=await connection(access)
  const allowed=await pontoAuthorizedAccounts(token)
  if(!allowed.includes(data.accountId))return reply({error:"ponto_account_not_authorized"},403)
  const page=await pontoBookedPage(token,data.accountId,typeof data.after==="string"?data.after:null)
  if(!page.rows.length)return reply({inserted:0,skipped:0,nextCursor:page.nextCursor})
  // Existing SECDEF RPC enforces organization roles and atomically rejects
  // conflicting IDs. Both manual CSV and Ponto share the same reconciliation.
  const {data:result,error}=await access.db.rpc("upt_admin_import_bank_statement_transactions",{p_rows:page.rows})
  if(error)return reply({error:error.code==="23505"?"conflicting_transaction":
   error.code==="42501"?"access_denied":"import_rejected"},error.code==="23505"?409:error.code==="42501"?403:422)
  if(!result||typeof result!=="object"||!("inserted" in result)||!("skipped" in result))
   return reply({error:"unexpected_import_result"},503)
  const inserted=typeof result.inserted==="number"?result.inserted:NaN
  const skipped=typeof result.skipped==="number"?result.skipped:NaN
  if(!Number.isSafeInteger(inserted)||!Number.isSafeInteger(skipped)||
    inserted<0||skipped<0||inserted+skipped!==page.rows.length)
   return reply({error:"unexpected_import_result"},503)
  return reply({inserted,skipped,nextCursor:page.nextCursor})
 }catch(error){return failed(error)}
}
