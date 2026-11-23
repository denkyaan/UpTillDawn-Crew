// Native equivalent of original Administration Ponto account listing and
// manually triggered bank import. No balances, IBAN, identities or provider
// credential values are exposed. Never initiate a transfer or mark paid.
import type {SupabaseClient} from "@supabase/supabase-js"
import {parseIntegrationConfiguration} from "../../../lib/administration/integration-credentials.ts"
import {requestHasSameOrigin} from "../../../lib/request-origin.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {openOAuthToken,validMasterKey} from "./provider-oauth.ts"
import {pontoAccessToken,pontoAuthorizedAccounts,pontoBookedPage} from "./native-ponto-readonly.ts"

type Db=Pick<SupabaseClient,"rpc">
type Env={UPT_INTEGRATION_ENCRYPTION_KEY?:string}
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
function errorResponse(error:unknown){
 const reason=error instanceof Error?error.message:"ponto_unavailable"
 if(reason==="ponto_not_configured")return response({error:reason},409)
 if(reason==="ponto_unauthorized")return response({error:reason},401)
 if(reason==="ponto_invalid_request")return response({error:reason},422)
 if(reason==="ponto_invalid_accounts"||reason==="ponto_invalid_content"||reason==="ponto_response_too_large"||
   reason==="invalid_ponto_response"||reason.startsWith("invalid_ponto_")||reason==="unsupported_ponto_currency")
  return response({error:"ponto_data_incompatible"},422)
 return response({error:"ponto_unavailable"},503)
}
async function authorize(db:Db):Promise<Response|null>{
 try{
  const {data,error}=await db.rpc("upt_can_manage_integrations")
  if(error)return response({error:"access_denied"},503)
  if(data!==true)return response({error:"access_denied"},403)
  return null
 }catch{return response({error:"access_denied"},503)}
}
async function bankToken(db:Db,env:Env){
 const {data,error}=await db.rpc("upt_integration_credentials",{
  p_action:"read",p_provider:"banking",p_ciphertext:null
 })
 if(error||!data||typeof data!=="object"||Array.isArray(data))
  throw Error("ponto_unavailable")
 const item=data as Record<string,unknown>
 if(item.configured===false)throw Error("ponto_not_configured")
 if(item.configured!==true||typeof item.ciphertext!=="string"||
  !validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY))
  throw Error("ponto_unavailable")
 const decrypted=await openOAuthToken("banking",item.ciphertext,env.UPT_INTEGRATION_ENCRYPTION_KEY!)
 const config=parseIntegrationConfiguration("banking",decrypted)
 if(!config)throw Error("ponto_unavailable")
 return pontoAccessToken(config)
}
/** GET returns only bank account UUID choices, exactly as original. */
export async function nativePontoGet(db:Db,env:Env):Promise<Response>{
 const denied=await authorize(db)
 if(denied)return denied
 try{
  const token=await bankToken(db,env)
  const accounts=await pontoAuthorizedAccounts(token)
  return response({accounts:accounts.map(id=>({id}))})
 }catch(error){return errorResponse(error)}
}
/** One explicitly authorized account and one booked transaction page per
 * request. Import uses the original audited SQL reconciliation transaction. */
export async function nativePontoPost(db:Db,request:Request,env:Env):Promise<Response>{
 if(!requestHasSameOrigin(request))return response({error:"forbidden"},403)
 const denied=await authorize(db)
 if(denied)return denied
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return response({error:"invalid_request"},415)
 let body:unknown
 try{body=await readStrictJson(request,256)}
 catch(error){return response({error:"invalid_request"},
  error instanceof Error&&error.message==="too_large"?413:400)}
 if(!body||typeof body!=="object"||Array.isArray(body))
  return response({error:"invalid_request"},422)
 const data=body as Record<string,unknown>
 if(Object.keys(data).some(key=>key!=="accountId"&&key!=="after")||
  typeof data.accountId!=="string"||!uuid.test(data.accountId)||
  (data.after!==null&&data.after!==undefined&&(typeof data.after!=="string"||!uuid.test(data.after))))
  return response({error:"invalid_request"},422)
 try{
  const token=await bankToken(db,env)
  const allowed=await pontoAuthorizedAccounts(token)
  if(!allowed.includes(data.accountId))return response({error:"ponto_account_not_authorized"},403)
  const page=await pontoBookedPage(token,data.accountId,typeof data.after==="string"?data.after:null)
  if(!page.rows.length)return response({inserted:0,skipped:0,nextCursor:page.nextCursor})
  const {data:result,error}=await db.rpc("upt_admin_import_bank_statement_transactions",{p_rows:page.rows})
  if(error)return response({error:error.code==="23505"?"conflicting_transaction":
   error.code==="42501"?"access_denied":"import_rejected"},
   error.code==="23505"?409:error.code==="42501"?403:422)
  const item=result&&typeof result==="object"&&!Array.isArray(result)?
   result as Record<string,unknown>:null
  const inserted=item?.inserted,skipped=item?.skipped
  if(!Number.isSafeInteger(inserted)||!Number.isSafeInteger(skipped)||
    typeof inserted!=="number"||typeof skipped!=="number"||
    inserted<0||skipped<0||inserted+skipped!==page.rows.length)
   return response({error:"unexpected_import_result"},503)
  return response({inserted,skipped,nextCursor:page.nextCursor})
 }catch(error){return errorResponse(error)}
}
