// Source-compatible God Mode observability without a Next.js service hop.
// The private expiring God cookie and database God-session RPC are required
// for every read; cross-environment data uses separately authorized Management
// credentials rather than the signed QA user's Supabase token.
import {parseCookieHeader} from "@supabase/ssr"
import {z} from "zod"
import type {SupabaseClient} from "@supabase/supabase-js"

export type MakerObservabilityPath="/api/god/logs"|"/api/god/platform-logs"|"/api/god/cloudflare-logs"
export type MakerObservabilityEnv={
 SUPABASE_URL:string
 CLOUDFLARE_OBSERVABILITY_CONFIG?:string
}
type Db=Pick<SupabaseClient,"rpc">
type Target="main"|"production"
const projects:{[key in Target]:string}={
 main:"npbjrtiolqperdgljnhi",production:"eakoavcieossazqzplke"
}
const studio=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
}})
class StudioError extends Error{
 constructor(message:string,readonly status=400){super(message)}
}
const generic="De actie kon niet worden voltooid. Vernieuw de status voordat je opnieuw opslaat."
const limits=z.coerce.number().int().min(1).max(100).default(50)
const logsInput=z.object({limit:limits,environment:z.enum(["main","production"]).optional()})
const platformInput=z.object({environment:z.enum(["main","production"]),limit:limits})
const cloudflareInput=z.object({
 environment:z.enum(["main","production"]),
 limit:limits,minutes:z.coerce.number().int().min(5).max(60).default(60)
}).strict()
const cfCredentials=z.object({
 accountId:z.string().regex(/^[a-f0-9]{32}$/i),
 token:z.string().min(20).max(500)
}).strict()
const sources=new Set(["postgres_logs","edge_logs","auth_logs","postgrest_logs",
 "realtime_logs","storage_logs","pgbouncer_logs","auth_audit_logs","function_edge_logs"])
function targetProject(target:Target){return projects[target]}
async function auth(db:Db,request:Request,cookies:string):Promise<string>{
 const site=request.headers.get("sec-fetch-site")
 const origin=request.headers.get("origin")
 if(site==="cross-site"||(origin&&origin!==new URL(request.url).origin))
  throw new StudioError("Ongeldige oorsprong.",403)
 const token=parseCookieHeader(cookies).find(x=>x.name==="uptilldawn-god-session")?.value
 if(!token)throw new StudioError("Meld opnieuw aan bij God Mode.",401)
 const {data,error}=await db.rpc("upt_god_session_valid",{p_token:token})
 if(error||data!==true)throw new StudioError("God Mode sessie verlopen.",401)
 return token
}
// Fixed URLs only, no browser-chosen project names, service keys or SQL.
async function jsonBounded(response:Response,max=1_000_000):Promise<unknown>{
 if(response.headers.get("content-length")&&
    Number(response.headers.get("content-length"))>max)
  throw new StudioError("De externe logs hebben een onverwacht formaat.",502)
 const reader=response.body?.getReader()
 if(!reader)throw new StudioError("De externe logs hebben een onverwacht formaat.",502)
 let bytes=0
 const chunks:Uint8Array[]=[]
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   bytes+=value.byteLength
   if(bytes>max){
    await reader.cancel().catch(()=>{})
    throw new StudioError("De externe logs hebben een onverwacht formaat.",502)
   }
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const merged=new Uint8Array(bytes)
 let at=0
 for(const chunk of chunks){merged.set(chunk,at);at+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(merged))}
 catch{throw new StudioError("De externe logs hebben een onverwacht formaat.",502)}
}
async function managementQuery(secret:string,project:string,query:string){
 const response=await fetch("https://api.supabase.com/v1/projects/"+project+"/database/query",{
  method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},
  body:JSON.stringify({query,read_only:true}),cache:"no-store",redirect:"manual",
  signal:AbortSignal.timeout(20_000)
 })
 if(!response.ok)throw new StudioError("De geselecteerde omgeving kan haar logs niet delen. Controleer de Supabase Management-koppeling.",503)
 const rows=await jsonBounded(response)
 if(!Array.isArray(rows))throw new StudioError("De externe logs hebben een onverwacht formaat.",502)
 return rows.slice(0,100)
}
async function logs(db:Db,token:string,request:Request,env:MakerObservabilityEnv){
 const input=logsInput.parse(Object.fromEntries(new URL(request.url).searchParams))
 // sourceReadSession already checks that this is the exact QA Supabase origin.
 if(env.SUPABASE_URL!=="https://"+projects.main+".supabase.co")
  throw new StudioError("Onbekende God Mode-omgeving.",503)
 const target=input.environment||"main"
 if(target==="main"){
  const {data,error}=await db.rpc("upt_god_maker_log_snapshot",{p_token:token,p_limit:input.limit})
  if(error)throw new StudioError("De logfunctie van deze omgeving is nog niet beschikbaar.",503)
  if(!data||typeof data!=="object")throw new StudioError("Onvolledige logregistratie.",503)
  return studio({logs:data,environment:target,source:"authenticated environment"})
 }
 const {data:secret,error}=await db.rpc("upt_god_database_secret",{p_token:token})
 if(error||typeof secret!=="string"||!secret)
  throw new StudioError("Koppel een Supabase Management-sleutel met leestoegang tot de andere omgeving.",428)
 const queries=[
  "select id,error_name,error_message,route,status,ai_severity,maker_action_required,reported_count,created_at,updated_at from public.user_error_reports order by created_at desc limit "+input.limit,
  "select id,check_type,status,checked_at from public.recovery_checks order by checked_at desc limit "+input.limit,
  "select id,action,entity_type,created_at from public.upt_audit_logs order by created_at desc limit "+input.limit
 ]
 const [errors,recovery,audit]=await Promise.all(queries.map(q=>managementQuery(secret,targetProject(target),q)))
 return studio({logs:{errors,recovery,audit},environment:target,source:"management read-only"})
}
async function platformLogs(db:Db,token:string,request:Request,env:MakerObservabilityEnv){
 const input=platformInput.parse(Object.fromEntries(new URL(request.url).searchParams))
 if(env.SUPABASE_URL!=="https://"+projects.main+".supabase.co")
  throw new StudioError("De Maker-omgeving is niet herkend.",503)
 const {data:secret,error}=await db.rpc("upt_god_database_secret",{p_token:token})
 if(error||typeof secret!=="string"||!secret)
  throw new StudioError("Koppel een Supabase Management API-token met analytics:read onder Koppelingen om platformlogs te bekijken.",428)
 const now=new Date(),from=new Date(now.getTime()-60*60*1000)
 const query=new URLSearchParams({
  sql:"select timestamp,source,event_message from logs order by timestamp desc limit "+input.limit,
  iso_timestamp_start:from.toISOString(),iso_timestamp_end:now.toISOString()
 })
 const response=await fetch("https://api.supabase.com/v1/projects/"+targetProject(input.environment)+
  "/analytics/endpoints/logs?"+query,{
  headers:{Authorization:"Bearer "+secret},cache:"no-store",redirect:"manual",
  signal:AbortSignal.timeout(20_000)
 })
 if(!response.ok){
  if(response.status===401||response.status===403)
   throw new StudioError("De Supabase Management API-token mist analytics:read of toegang tot dit project.",403)
  throw new StudioError("Supabase-platformlogs zijn momenteel niet beschikbaar ("+response.status+").",503)
 }
 const payload=await jsonBounded(response) as {result?:unknown;error?:string}
 if(payload?.error||!Array.isArray(payload?.result))
  throw new StudioError("De platformlogzoekopdracht gaf geen geldige gegevens terug.",502)
 const result=payload.result.slice(0,input.limit).flatMap((value:unknown)=>{
  if(!value||typeof value!=="object")return []
  const row=value as {timestamp?:unknown;source?:unknown;event_message?:unknown}
  if(typeof row.timestamp!=="string"||typeof row.source!=="string"||!sources.has(row.source))return []
  return [{timestamp:row.timestamp,source:row.source,
   message:typeof row.event_message==="string"?row.event_message.slice(0,1800):""}]
 })
 return studio({environment:input.environment,source:"supabase-management",readOnly:true,windowMinutes:60,logs:result})
}
async function cloudflareLogs(request:Request,env:MakerObservabilityEnv){
 const input=cloudflareInput.parse(Object.fromEntries(new URL(request.url).searchParams))
 const raw=env.CLOUDFLARE_OBSERVABILITY_CONFIG
 if(!raw)throw new StudioError("Cloudflare Workers Logs zijn nog niet verbonden. Configureer een afzonderlijk Observability-token.",428)
 let settings:unknown
 try{settings=JSON.parse(raw)}catch{throw new StudioError("Cloudflare-logging is niet correct geconfigureerd.",503)}
 const parsed=cfCredentials.safeParse(settings)
 if(!parsed.success)throw new StudioError("Cloudflare-logging is niet correct geconfigureerd.",503)
 const script=input.environment==="main"?"uptilldawn-main":"uptilldawn-crew"
 const now=Date.now()
 const response=await fetch("https://api.cloudflare.com/client/v4/accounts/"+parsed.data.accountId+
  "/workers/observability/telemetry/query",{
  method:"POST",headers:{Authorization:"Bearer "+parsed.data.token,"Content-Type":"application/json"},
  body:JSON.stringify({
   queryId:"god-mode-runtime-"+input.environment,dry:true,view:"events",limit:input.limit,
   timeframe:{from:now-input.minutes*60000,to:now},
   parameters:{datasets:["cloudflare-workers"],filterCombination:"and",
    filters:[{key:"$metadata.service",type:"string",operation:"eq",kind:"filter",value:script}]}
  }),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(15_000)
 })
 if(response.status===401||response.status===403)
  throw new StudioError("Cloudflare-token heeft geen Workers Observability-queryrechten.",403)
 if(!response.ok)throw new StudioError("Cloudflare Workers Logs zijn tijdelijk niet beschikbaar ("+response.status+").",503)
 const payload=await jsonBounded(response) as {
  success?:boolean;result?:{events?:{events?:unknown[]}};errors?:unknown[]
 }
 const items=payload?.result?.events?.events
 if(payload?.success!==true||!Array.isArray(items))
  throw new StudioError("Cloudflare gaf geen geldig Workers Logs-resultaat terug.",502)
 const output=items.slice(0,input.limit).flatMap((value:unknown)=>{
  if(!value||typeof value!=="object")return []
  const item=value as {timestamp?:unknown;source?:unknown;"$metadata"?:unknown;"$workers"?:unknown}
  const meta=(item.$metadata||{}) as {service?:unknown;error?:unknown;message?:unknown}
  const worker=(item.$workers||{}) as {scriptName?:unknown}
  if(meta.service!==script&&worker.scriptName!==script)return []
  const date=typeof item.timestamp==="number"&&Number.isFinite(item.timestamp)?new Date(item.timestamp):null
  if(!date||Number.isNaN(date.getTime()))return []
  const source=typeof item.source==="string"?item.source:
   typeof item.source==="object"?JSON.stringify(item.source):""
  const message=typeof meta.error==="string"?meta.error:
   typeof meta.message==="string"?meta.message:source
  return [{timestamp:date.toISOString(),source:"Cloudflare · "+script,message:message.slice(0,1800)}]
 })
 return studio({environment:input.environment,source:"cloudflare-workers",readOnly:true,
  windowMinutes:input.minutes,script,logs:output})
}
export async function makerObservabilityResponse(
 db:Db,request:Request,cookies:string,env:MakerObservabilityEnv,path:MakerObservabilityPath
):Promise<Response>{
 try{
  const token=await auth(db,request,cookies)
  if(path==="/api/god/logs")return await logs(db,token,request,env)
  if(path==="/api/god/platform-logs")return await platformLogs(db,token,request,env)
  return await cloudflareLogs(request,env)
 }catch(error){
  if(error instanceof z.ZodError){
   const code=path==="/api/god/logs"?"Ongeldige logaanvraag.":
    path==="/api/god/platform-logs"?"Ongeldige platformlogaanvraag.":"Ongeldige Cloudflare-logaanvraag."
   return studio({error:code},400)
  }
  return error instanceof StudioError?studio({error:error.message},error.status):studio({error:generic},500)
 }
}
