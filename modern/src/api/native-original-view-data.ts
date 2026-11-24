// Complete original Main /api/migration/view-data DTO contracts, no Next
// Worker/service binding. Every database call is user-signed and subject to RLS.
// Original source: app/api/migration/view-data/route.ts (six read-only IDs).
import type {SupabaseClient} from "@supabase/supabase-js"
import {parseCookieHeader} from "@supabase/ssr"
import {boundedMigrationJson} from "../../../lib/migration/bounded-json.ts"
import {canOpenPortal,type PortalAssignment} from "../../../lib/portal-access.ts"
import {integrationServicesForWorkspace} from "../../../lib/administration/integration-placement.ts"
import {externalServicesReadiness} from "../../../lib/administration/external-services-readiness.ts"
import {isIntegrationProvider} from "../../../lib/administration/integration-credentials.ts"
import {validMasterKey} from "./provider-oauth.ts"
import {godSourceReadResponse} from "./native-maker-reads.ts"
import type {VerifiedIdentity} from "../shared/identity.ts"

type Environment=Readonly<Record<string,string|undefined>>
type Db=Pick<SupabaseClient,"rpc"|"from">
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"} as const
const unavailable=(status:number)=>Response.json({error:"view_data_unavailable"},{status,headers})
const reply=(value:unknown)=>Response.json({value},{headers})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

/** Matches administrationPageAccess: owner and permanent Admin bypass portal
 * assignment; all other approved users need a signed, non-revoked portal row. */
async function administrationAccess(db:Db,identity:VerifiedIdentity):Promise<number>{
 if(!identity.is_owner&&(!identity.approved||identity.account_blocked))return 403
 if(identity.is_owner||identity.role==="admin")return 200
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 if(error)return 503
 if(!canOpenPortal("administration",(Array.isArray(data)?data:[]) as PortalAssignment[],{
  approved:identity.approved,blocked:identity.account_blocked
 }))return 403
 return 200
}
async function integrationAccess(db:Db,administration:number):Promise<boolean>{
 if(administration!==200)return false
 const {data,error}=await db.rpc("upt_can_manage_integrations")
 return !error&&data===true
}
function providerReady(env:Environment,key:string):boolean{
 return typeof env[key]==="string"&&Boolean(env[key]?.trim())
}
function userOAuthReady(env:Environment,provider:"sumup"|"peppol"):boolean{
 const prefix=provider==="sumup"?"UPT_SUMUP":"UPT_BILLIT"
 return providerReady(env,prefix+"_OAUTH_CLIENT_ID")&&
  providerReady(env,prefix+"_OAUTH_CLIENT_SECRET")&&
  (provider!=="peppol"||!env.UPT_BILLIT_OAUTH_ENV||
   ["sandbox","production"].includes(env.UPT_BILLIT_OAUTH_ENV))
}
/** No integration secrets, raw provider response bodies, or ciphertext ever
 * enter the externally visible result. All reads use the signed caller. */
async function externalServicesView(
 db:Db,identity:VerifiedIdentity,env:Environment,services:readonly {id:string}[],
 administration:number
):Promise<unknown>{
 const access=await integrationAccess(db,administration)
 let lookup:{available:boolean;rows:{provider:string}[]}={available:false,rows:[]}
 if(access){
  try{
   const {data,error}=await db.rpc("upt_integration_credentials",{
    p_action:"list",p_provider:null,p_ciphertext:null
   })
   if(error||!Array.isArray(data)||data.length>100)throw Error("unavailable")
   const rows=data.map(entry=>{
    if(!entry||typeof entry!=="object"||!isIntegrationProvider(entry.provider)||
       typeof entry.updated_at!=="string")throw Error("invalid")
    return {provider:entry.provider}
   })
   lookup={available:true,rows}
  }catch{}
 }
 let events:{data:unknown;error:boolean|null}|null=null
 if(access&&services.some(service=>service.id==="weeztix")){
  const result=await db.from("events").select("id,name")
   .order("start_at",{ascending:false}).limit(100)
  events={data:result.data,error:result.error?true:null}
 }
 return {
  access:{ok:access},lookup,events,
  oauthStorageReady:access&&validMasterKey(env.UPT_INTEGRATION_ENCRYPTION_KEY),
  weeztixReady:access&&providerReady(env,"UPT_WEEZTIX_OAUTH_CLIENT_ID")&&
   providerReady(env,"UPT_WEEZTIX_OAUTH_CLIENT_SECRET"),
  oauthReady:{
   sumup:access&&userOAuthReady(env,"sumup"),
   peppol:access&&userOAuthReady(env,"peppol")
  }
 }
}
function documensoOrigin(env:Environment):string|null{
 const raw=env.DOCUMENSO_BASE_URL
 if(!raw||!env.DOCUMENSO_API_KEY)return null
 try{
  const u=new URL(raw)
  if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||
     u.pathname!=="/"||u.href!==u.origin+"/")return null
  const host=u.hostname.toLowerCase()
  if(!host||host==="localhost"||host.endsWith(".localhost")||
     host.endsWith(".local")||host==="[::1]"||host==="[::]"||
     host.startsWith("[fc")||host.startsWith("[fd")||host.startsWith("[fe80"))return null
  const parts=host.split(".").map(Number)
  if(parts.length===4&&parts.every(n=>Number.isInteger(n)&&n>=0&&n<=255)){
   const [a,b]=parts
   if(a===0||a===10||a===127||a===169&&b===254||
      a===172&&b>=16&&b<=31||a===192&&b===168||a>=224)return null
  }
  return u.origin
 }catch{return null}
}
async function boundedStatus(response:Response){
 if(!response.ok)return ""
 const length=response.headers.get("content-length")
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>8192))return ""
 if(!response.body)return ""
 const reader=response.body.getReader()
 let total=0;const chunks:Uint8Array[]=[]
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   total+=value.byteLength
   if(total>8192){await reader.cancel().catch(()=>{});return ""}
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const bytes=new Uint8Array(total);let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{
  const parsed:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))
  return parsed&&typeof parsed==="object"&&"status" in parsed?
   String((parsed as {status?:unknown}).status):""
 }catch{return ""}
}
export async function signingConnectionView(env:Environment):Promise<unknown>{
 const origin=documensoOrigin(env)
 if(!origin)return {configured:false,healthy:false,certificateReady:false,reason:"not_configured"}
 try{
  const [health,certificate]=await Promise.all([
   fetch(origin+"/api/health",{
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)
   }),
   fetch(origin+"/api/certificate-status",{
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)
   })
  ])
  if(!health.ok||!certificate.ok)return {
   configured:true,healthy:false,certificateReady:false,reason:"unreachable"
  }
  const [healthStatus,certificateStatus]=await Promise.all([
   boundedStatus(health),boundedStatus(certificate)
  ])
  const healthy=healthStatus==="ok",certificateReady=certificateStatus==="ok"
  return {configured:true,healthy,certificateReady,
   reason:healthy&&certificateReady?"ready":"certificate_missing"}
 }catch{return {configured:true,healthy:false,certificateReady:false,reason:"unreachable"}}
}
/** Same original read-only signing preflight. RLS on the request ledger is
 * default-deny; never reinterpret a denied read as a missing signing request. */
async function artistSigningPreflight(db:Db,input:unknown):Promise<unknown>{
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("input")
 const object=input as Record<string,unknown>
 const bookingId=object.bookingId,versionId=object.agreementVersionId
 if(typeof bookingId!=="string"||typeof versionId!=="string"||
    !uuid.test(bookingId)||!uuid.test(versionId))throw Error("input")
 const version=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,approved_at").eq("id",versionId)
  .eq("booking_id",bookingId).maybeSingle()
 if(version.error||!version.data)throw Error("version")
 const record=await db.from("administration_contract_signing_requests")
  .select("document_type,document_id,document_version,document_sha256,envelope_id,status,signed_pdf_path")
  .eq("document_type","artist").eq("document_id",version.data.id)
  .eq("document_version",version.data.version_number).maybeSingle()
 if(record.error)throw Error("ledger")
 const row=record.data as Record<string,unknown>|null
 if(row&&(
  row.document_type!=="artist"||row.document_id!==version.data.id||
  row.document_version!==version.data.version_number||
  !Number.isSafeInteger(row.document_version)||Number(row.document_version)<1||
  typeof row.document_sha256!=="string"||!/^[a-f0-9]{64}$/.test(row.document_sha256)||
  !["draft","sent","completed","rejected","cancelled"].includes(String(row.status))||
  (row.envelope_id!==null&&(typeof row.envelope_id!=="string"||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.envelope_id)))||
  (row.status!=="draft"&&row.envelope_id===null)||
  (row.signed_pdf_path!==null&&(row.status!=="completed"||row.envelope_id===null))
 ))throw Error("invalid_ledger")
 const reasons:string[]=[]
 if(!version.data.approved_at)reasons.push("approval_missing")
 if(!row)reasons.push("signing_request_missing")
 else{
  if(!row.envelope_id)reasons.push("envelope_missing")
  if(row.status!=="draft")reasons.push("not_draft")
 }
 reasons.push("dispatch_disabled","archive_verification_required")
 return {ready:false,reasons,status:row?.status??null}
}
export async function nativeOriginalViewData(
 db:Db,identity:VerifiedIdentity,request:Request,cookieHeader:string,
 env:Environment
):Promise<Response>{
 const url=new URL(request.url),site=request.headers.get("sec-fetch-site")
 if(request.headers.get("origin")!==url.origin||(site!==null&&site!=="same-origin"))
  return unavailable(403)
 let parsed:unknown
 try{parsed=await boundedMigrationJson(request)}catch{return unavailable(400)}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return unavailable(400)
 const body=parsed as {id?:unknown;args?:unknown}
 if(!Array.isArray(body.args))return unavailable(400)
 if(body.id==="portal-preference"){
  const last=parseCookieHeader(cookieHeader).find(c=>c.name==="uptilldawn-last-portal")?.value
  return reply({lastPortal:last==="events"||last==="promotion"||last==="administration"?last:null})
 }
 if(body.id==="god-session-rpc"){
  if(!identity.is_owner)return unavailable(403)
  return godSourceReadResponse(db,cookieHeader,body.args)
 }
 const page=await administrationAccess(db,identity)
 if(page!==200&&body.id!=="external-services"&&body.id!=="external-services-view")
  return unavailable(page)
 try{
  if(body.id==="external-services"){
   const workspace=typeof body.args[0]==="string"?body.args[0]:""
   if(page!==200&&workspace!=="sales")return unavailable(403)
   return reply(integrationServicesForWorkspace(workspace,externalServicesReadiness(env)))
  }
  if(body.id==="external-services-view"){
   const ids=new Set<string>(Array.isArray(body.args[0])?
    body.args[0].map((entry:unknown)=>entry&&typeof entry==="object"&&
      "id" in entry?String((entry as {id:unknown}).id):"") : [])
   if(page!==200&&Array.from(ids).some(id=>id!=="sumup"&&id!=="eventpay"))
    return unavailable(403)
   const services=externalServicesReadiness(env).filter(service=>ids.has(service.id))
   return reply(await externalServicesView(db,identity,env,services,page))
  }
  if(body.id==="signing-connection")return reply(await signingConnectionView(env))
  if(body.id==="artist-signing-preflight"){
   const input=body.args[0]
   if(!input||typeof input!=="object"||Array.isArray(input)||
      ![input.bookingId,input.agreementVersionId].every(
       value=>typeof value==="string"&&uuid.test(value)))return unavailable(400)
   return reply(await artistSigningPreflight(db,input))
  }
  return unavailable(404)
 }catch{return unavailable(503)}
}
