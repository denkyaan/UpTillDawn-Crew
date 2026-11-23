// Original user error reporting and real Maker AI calibration pipeline.
// No production writes. Worker requires signed approved SSR identity first,
// QA write gate before RLS, and passes waitUntil to Cloudflare for bounded
// background processing. An AI diagnosis NEVER implies the bug was repaired.
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {processErrorReport,type ErrorAiBinding} from "../../../lib/error-report-ai.ts"
import {godRequestCrossSite} from "./native-maker-reads.ts"
const reportSchema=z.object({
 route:z.string().trim().min(1).max(500),
 errorName:z.string().trim().max(200).optional().default(""),
 errorMessage:z.string().trim().min(1).max(4000),
 stackTrace:z.string().max(12000).optional().default(""),
 source:z.enum(["boundary","runtime","promise","manual","api"]).default("manual"),
 clientContext:z.record(z.string(),z.unknown()).optional().default({})
}).strict()
export async function nativeClientErrorReport(
 db:SupabaseClient,request:Request,ai:ErrorAiBinding|undefined,
 waitUntil:((p:Promise<unknown>)=>void)|undefined
):Promise<Response>{
 if(godRequestCrossSite(request))
  return Response.json({error:"Ongeldige oorsprong."},{status:403})
 const {data:approved,error:approvedError}=await db.rpc("upt_is_approved")
 if(approvedError||approved!==true)
  return Response.json({error:"Aanmelden vereist."},{status:401})
 let raw:unknown
 try{raw=await readStrictJson(request)}
 catch(error){return Response.json({error:"Ongeldig of te groot foutrapport."},{
  status:error instanceof Error&&error.message==="too_large"?413:400
 })}
 const parsed=reportSchema.safeParse(raw)
 if(!parsed.success)return Response.json({error:"Ongeldig foutrapport."},{status:400})
 const input=parsed.data
 const {data,error}=await db.rpc("upt_report_client_error",{
  p_route:input.route,p_error_name:input.errorName,
  p_error_message:input.errorMessage,
  p_stack_trace:input.stackTrace||undefined,p_source:input.source,
  p_client_context:input.clientContext
 })
 if(error)return Response.json({
  error:error.message||"Foutrapport kon niet worden opgeslagen."
 },{status:400})
 const result=(data&&typeof data==="object"&&!Array.isArray(data)?data:{}) as {
  id?:unknown;deduplicated?:unknown
 }
 const id=typeof result.id==="string"?result.id:null
 if(!id)return Response.json({error:"Foutrapport kon niet worden opgeslagen."},{status:500})
 const job=processErrorReport(db as Parameters<typeof processErrorReport>[0],id,ai)
 if(waitUntil)waitUntil(job)
 else void job.catch(()=>console.error("[error-report] background job failed"))
 return Response.json({
  ok:true,id,deduplicated:result.deduplicated===true,
  message:"Fout gemeld. De AI-assistent bekijkt dit nu op de achtergrond."
 },{status:202,headers:{"Cache-Control":"no-store"}})
}
