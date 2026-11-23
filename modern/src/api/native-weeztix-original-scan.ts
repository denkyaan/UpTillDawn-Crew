// Source-compatible, cookie-authenticated entrance scan endpoint.
// The signed user and original SQL SECDEF scoped Weeztix check are required;
// never interpret a decoded barcode as an admission by itself.
import type {SupabaseClient} from "@supabase/supabase-js"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {requestHasSameOrigin} from "../../../lib/request-origin.ts"
import {scanWeeztix,scannerReady,validScanRequest,type ScannerBindings,type RpcDb}
 from "./weeztix-scan.ts"
import type {VerifiedIdentity} from "../shared/identity.ts"

const response=(code:string,status:number)=>Response.json({ok:false,code},{
 status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
})
export async function nativeWeeztixSourceScan(
 db:SupabaseClient,identity:VerifiedIdentity,request:Request,env:ScannerBindings
):Promise<Response>{
 if(!requestHasSameOrigin(request))return response("forbidden",403)
 if(!identity.approved||identity.account_blocked)return response("forbidden",403)
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
  return response("invalid_request",415)
 if(!scannerReady(env,request.url))return response("not_configured",503)
 let body:unknown
 try{body=await readStrictJson(request,1024)}
 catch{return response("invalid_request",400)}
 if(!validScanRequest(body))return response("invalid_request",422)
 // The RPC itself validates current event, entrance workplace, non-archived
 // status, role assignments and signed staff approval (including explicit
 // administrative override). Never trust browser claims or workplace labels.
 const result=await scanWeeztix(db as unknown as RpcDb,env,body)
 return Response.json(result.body,{status:result.status,headers:{
  "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
 }})
}
