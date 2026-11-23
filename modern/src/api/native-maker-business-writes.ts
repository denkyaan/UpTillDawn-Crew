// Original Maker Studio mutations, separated from the old Next runtime.
// The Hono router enforces UPT_MIGRATION_ALLOW_WRITES before invoking this
// module. Every invocation revalidates the signed user's separate, short-lived
// Maker session; database SECDEF RPCs retain their own Maker authorization.
import type {SupabaseClient} from "@supabase/supabase-js"
import {parseCookieHeader} from "@supabase/ssr"
import {z} from "zod"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {evaluateReleaseEvidence,type DeployEvidence,type ErrorReportEvidence}
 from "../../../lib/god-mode-resolution-evidence.ts"
import {makerGithubRead} from "./native-maker-studio-reads.ts"
import {godRequestCrossSite} from "./native-maker-reads.ts"

export type MakerBusinessMethod="automation"|"data"|"report"|"connect"|"disconnect"
const QA_URL="https://npbjrtiolqperdgljnhi.supabase.co"
const REPOSITORY="denkyaan/UpTillDawn-Crew"
const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
const generic="De actie kon niet worden voltooid. Vernieuw de status voordat je opnieuw opslaat."
class SourceError extends Error{
 status:number
 constructor(message:string,status=400){super(message);this.status=status}
}
async function authorized(db:SupabaseClient,request:Request,cookies:string,environment:string){
 if(environment!==QA_URL)throw new SourceError("Onbekende Maker-omgeving.",503)
 if(godRequestCrossSite(request))throw new SourceError("Ongeldige oorsprong.",403)
 const token=parseCookieHeader(cookies).find(c=>c.name==="uptilldawn-god-session")?.value
 if(!token)throw new SourceError("Meld opnieuw aan bij God Mode.",401)
 const result=await db.rpc("upt_god_session_valid",{p_token:token})
 if(result.error||result.data!==true)throw new SourceError("God Mode sessie verlopen.",401)
 return token
}
async function makerBody(request:Request,max=32_768){
 try{return await readStrictJson(request,max)}
 catch{throw new SourceError("Ongeldige aanvraag.",400)}
}
const integer=z.number().int().min(0).max(10080)
const rule=z.object({
 automation_key:z.string().trim().min(1).max(120).regex(/^[a-z0-9_-]+$/),
 enabled:z.boolean(),
 delay_minutes:integer.optional(),
 reminder_minutes:integer.optional(),
 escalation_minutes:integer.optional(),
 cooldown_minutes:integer.optional(),
 max_retries:z.number().int().min(0).max(100).optional(),
 channels:z.array(z.enum(["in_app","push","email"])).min(1).max(3).optional()
})
async function automation(db:SupabaseClient,request:Request){
 const {data:owner,error:ownerError}=await db.rpc("upt_current_is_owner")
 if(ownerError||owner!==true)
  throw new SourceError("Alleen de maker kan automatiseringen beheren.",403)
 let body:z.infer<typeof rule>
 try{body=rule.parse(await makerBody(request))}
 catch(error){if(error instanceof SourceError)throw error;throw new SourceError("Ongeldige automatiseringsinstelling.",400)}
 const {data:current,error:readError}=await db.from("automation_rules")
  .select("delay_minutes,reminder_minutes,escalation_minutes,cooldown_minutes,max_retries,channels")
  .eq("automation_key",body.automation_key).single()
 if(readError||!current)throw new SourceError(generic,500)
 const {error}=await db.rpc("upt_save_automation_rule",{
  p_key:body.automation_key,p_enabled:body.enabled,
  p_delay_minutes:body.delay_minutes??current.delay_minutes,
  p_reminder_minutes:body.reminder_minutes??current.reminder_minutes??0,
  p_escalation_minutes:body.escalation_minutes??current.escalation_minutes??0,
  p_cooldown_minutes:body.cooldown_minutes??current.cooldown_minutes,
  p_max_retries:body.max_retries??current.max_retries,
  p_channels:body.channels??(current.channels?.length?current.channels:["in_app"])
 })
 if(error)throw new SourceError(generic,500)
 return reply({ok:true})
}
const dataSchema=z.object({
 table:z.string().min(1).max(100),
 operation:z.enum(["insert","update","delete"]),
 key:z.record(z.string(),z.unknown()),
 before:z.record(z.string(),z.unknown()).nullable(),
 values:z.record(z.string(),z.unknown())
}).strict()
async function dataMutation(db:SupabaseClient,token:string,request:Request){
 let body:z.infer<typeof dataSchema>
 try{body=dataSchema.parse(await makerBody(request,2_000_000))}
 catch(error){if(error instanceof SourceError)throw error;throw new SourceError("Ongeldige gegevens.",400)}
 const {data,error}=await db.rpc("upt_god_data_mutate",{
  p_token:token,p_table:body.table,p_operation:body.operation,
  p_key:body.key,p_before:body.before,p_values:body.values
 })
 if(error){
  const conflict=typeof error.message==="string"&&error.message.includes("Row changed")
  throw new SourceError(conflict?"Deze rij is intussen gewijzigd. Laad de gegevens opnieuw.":
   "Wijziging geweigerd: controleer verplichte velden, gegevenstypes en gekoppelde records.",
   conflict?409:400)
 }
 return reply(data)
}
const uuid=z.string().uuid()
const sha=z.string().regex(/^[a-f0-9]{40}$/i)
const reportSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("mark_working"),reportId:uuid}).strict(),
 z.object({action:z.literal("resolve"),reportId:uuid,
  note:z.string().trim().min(30).max(4000),sha}).strict()
])
async function errorReport(db:SupabaseClient,token:string,request:Request){
 let input:z.infer<typeof reportSchema>
 try{input=reportSchema.parse(await makerBody(request,10_240))}
 catch(error){if(error instanceof SourceError)throw error;throw new SourceError("Ongeldige aanvraag.",400)}
 if(input.action==="mark_working"){
  const {error}=await db.rpc("upt_god_error_report_mark_working",{
   p_token:token,p_report:input.reportId
  })
  if(error)throw new SourceError(generic,500)
  return reply({ok:true})
 }
 // Main candidate is permanently pinned to Main QA Auth. It can inspect but
 // cannot write to a different environment's God Mode or close production bugs.
 const {data:reports,error:reportsError}=await db.rpc("upt_god_error_reports",{
  p_token:token,p_limit:100
 })
 if(reportsError)throw new SourceError("Foutrapporten zijn tijdelijk niet controleerbaar.",503)
 const found=Array.isArray(reports)?reports.find(x=>x&&typeof x==="object"&&
  (x as {id?:unknown}).id===input.reportId):undefined
 if(!found)throw new SourceError("Foutrapport niet meer gevonden. Vernieuw de lijst.",409)
 const raw=await makerGithubRead("/actions/workflows/deploy-main.yml/runs?per_page=50") as
  {workflow_runs?:DeployEvidence[]}
 const evidence=evaluateReleaseEvidence({
  environment:"main",sha:input.sha,report:found as ErrorReportEvidence,
  runs:Array.isArray(raw?.workflow_runs)?raw.workflow_runs:[],
  productionCurrentSha:null
 })
 if(!evidence.ok)throw new SourceError(evidence.reason,409)
 const note=input.note+" | main deployment verified: "+evidence.sha+
  " / GitHub Actions #"+evidence.runId
 const {error}=await db.rpc("upt_god_error_report_resolve",{
  p_token:token,p_report:input.reportId,p_note:note
 })
 if(error)throw new SourceError("Foutrapport kon niet worden afgesloten. Vernieuw de status.",409)
 return reply({ok:true,evidence:{sha:evidence.sha,runId:evidence.runId,environment:"main"}})
}
async function connection(db:SupabaseClient,token:string,request:Request,disconnect:boolean){
 if(disconnect){
  const {error}=await db.rpc("upt_god_repository_disconnect",{p_token:token})
  if(error)throw new SourceError("Ontkoppelen mislukt.",503)
  return reply({ok:true})
 }
 let credential:string
 try{credential=z.object({credential:z.string().trim().min(20).max(500)}).strict()
  .parse(await makerBody(request,2048)).credential}
 catch(error){if(error instanceof SourceError)throw error;throw new SourceError("Vul een geldige GitHub-sleutel in.",400)}
 const repo=await makerGithubRead("",credential) as
  {full_name?:unknown;permissions?:{push?:unknown}}
 if(repo.full_name!==REPOSITORY||repo.permissions?.push!==true)
  throw new SourceError("Deze sleutel heeft geen schrijftoegang tot UpTillDawn-Crew.",403)
 const {error}=await db.rpc("upt_god_repository_connect",{
  p_token:token,p_secret:credential
 })
 if(error)throw new SourceError("De GitHub-koppeling kon niet worden opgeslagen.",503)
 return reply({ok:true})
}
export async function nativeMakerBusinessResponse(
 db:SupabaseClient,request:Request,cookies:string,env:{SUPABASE_URL:string},method:MakerBusinessMethod
):Promise<Response>{
 try{
  const token=await authorized(db,request,cookies,env.SUPABASE_URL)
  if(method==="automation")return await automation(db,request)
  if(method==="data")return await dataMutation(db,token,request)
  if(method==="report")return await errorReport(db,token,request)
  return await connection(db,token,request,method==="disconnect")
 }catch(error){
  if(error instanceof SourceError)return reply({error:error.message},error.status)
  // GitHub errors are intentionally generic rather than exposing tokens,
  // provider data or Cloudflare HTTP response bodies.
  return reply({error:generic},500)
 }
}
