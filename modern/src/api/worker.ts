import {Hono} from "hono"
import {forwardMainSource,originalApiAllowed} from "./main-source.ts"
import {sourceReadSession,attachSourceCookies,pushConfigResponse,portalPreferenceResponse} from "./native-main-reads.ts"
import {administrationCsvResponse,type AdminExportDb} from "./native-administration-exports.ts"
import {administrationReportResponse,type AdminReportKind} from "./native-administration-reports.ts"
import {createClient} from "@supabase/supabase-js"
import {isActive,parseIdentity} from "../shared/identity.ts"
import {sanitizedMakerRoute,sanitizedMakerName,sanitizedMakerSeverity} from "./god-redaction.ts"
import {
 isOAuthProvider,oauthReady,oauthOrigin,oauthCallback,
 authorizationUrl,startOAuthState,verifyOAuthState,clearOAuthCookie,
 sealOAuthToken,exchangeOAuthCode,tokenConfiguration,type OAuthBindings
} from "./provider-oauth.ts"
import {scannerReady,scannerOrigin,validScanRequest,scanWeeztix,type ScannerBindings,type RpcDb} from "./weeztix-scan.ts"
import {forwardMainAuth,type MainAuthBindings} from "./main-auth.ts"
import {makerReadResponse,godSourceReadResponse,userErrorReportReadResponse,type GodReadPath,type ReadDb} from "./native-maker-reads.ts"
import {nativeAdminActionAllowed,nativeAdminActionResponse,type NativeAdminActionDb} from "./native-admin-actions.ts"
import {nativeWaveTwoAllowed,nativeWaveTwoActionResponse} from "./native-platform-actions.ts"
import {nativeWaveThreeAllowed,nativeWaveThreeActionResponse} from "./native-event-shift-actions.ts"
import {nativeInventoryActionAllowed,nativeInventoryActionResponse} from "./native-inventory-checklist-actions.ts"

type Bindings={SUPABASE_URL:string;SUPABASE_ANON_KEY:string;UPT_MIGRATION_ALLOW_WRITES?:string;ASSETS?:{fetch:(request:Request)=>Promise<Response>}}&OAuthBindings&ScannerBindings&MainAuthBindings
const app=new Hono<{Bindings:Bindings}>()

// If a future rename accidentally binds the former Main service to THIS
// candidate, terminate the first forwarded hop. Never recurse into the same
// Worker until Cloudflare Free CPU/memory limits are exhausted.
app.use("*",async(c,next)=>{
 if(c.req.header("x-uptilldawn-main-bridge")==="original-read-v1")
  return c.json({error:"main_backend_recursion_blocked"},508)
 await next()
})

// Static navigation and images bypass this Worker entirely. Only /api/*
// invokes Hono, with no Next runtime, SSR, or privileged application secrets.
app.use("/api/*",async(c,next)=>{
 await next()
 c.header("Cache-Control","private, no-store")
 c.header("X-Content-Type-Options","nosniff")
 c.header("Referrer-Policy","no-referrer")
 c.header("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")
})

app.get("/api/v1/health",c=>{
 // Public deployment readiness only. Do not invoke authentication, private
 // configuration, Supabase or mail to discover the visible Worker version.
 if(c.env.MAIN_AUTH_RUNTIME)c.header('X-UpTillDawn-Auth-Protocol','main-auth-native-v1')
 return c.json({ok:true,service:"uptilldawn-local-first-api"})
})

/** Source-identical read routes. Preserve real Supabase SSR cookies and
 * original user-scoped RPC access; do not invoke the legacy Next Worker. */
app.get("/api/push/config",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:actor.status===401?"Aanmelden vereist.":"Push is nog niet geconfigureerd."},actor.status)
 return attachSourceCookies(await pushConfigResponse(actor.db),actor)
})

// The original source serializers, RLS and permission RPCs are reused.
// No Next/SSR or original Main Worker binding for these six read-only
// administrative requests. Each GET authenticates its own signed session.
for(const [path,kind] of [
 ["/api/administration/finance/summary/export","finance"],
 ["/api/administration/ticketing/event-summary","tickets"],
 ["/api/administration/ticketing/export","ticket-sales"],
 ["/api/administration/payroll/export","payroll"]
] as const){
 app.get(path,async c=>{
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:kind==="payroll"?"access_denied":"forbidden"},actor.status)
  return attachSourceCookies(await administrationCsvResponse(
   actor.db as unknown as AdminExportDb,kind,
   new URL(c.req.url).searchParams.get("event")),actor)
 })
}
for(const [path,kind] of [
 ["/api/administration/provider-mappings","provider-mappings"],
 ["/api/administration/provider-transactions","provider-transactions"]
] as const){
 app.get(path,async c=>{
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"access_denied"},actor.status)
  return attachSourceCookies(await administrationReportResponse(
   actor.db as unknown as import("@supabase/supabase-js").SupabaseClient,
   kind as AdminReportKind,c.req.url),actor)
 })
}

// Owner-only God Mode reads and user error-report status no longer invoke
// the expensive Next/SSR Worker. Writes and cross-environment operations
// remain on the original authenticated service.
for(const path of [
 "/api/god/automation-rules","/api/god/preview-role","/api/god/rules",
 "/api/god/data","/api/god/error-reports"
] as const){
 app.get(path,async c=>{
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await makerReadResponse(
   actor.db as unknown as ReadDb,c.req.raw,actor.cookieHeader,path as GodReadPath),actor)
 })
}
app.get("/api/error-reports",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await userErrorReportReadResponse(
  actor.db as unknown as ReadDb,c.req.raw),actor)
})

// The source uses POST for this read DTO. Only the strictly recognized
// preference query migrates here; all other IDs stay on original Main until
// independently ported and verified. Inspect a bounded clone, never consume
// a body that will be forwarded.
app.post("/api/migration/view-data",async c=>{
 const request=c.req.raw
 const origin=new URL(request.url).origin
 const site=request.headers.get("sec-fetch-site")
 if(request.headers.get("origin")!==origin||(site&&site!=="same-origin"&&site!=="none"))
  return c.json({error:"invalid_origin"},403)
 const payload=await boundedJson(request.clone(),4096)
 if(!payload||!Array.isArray(payload.args)||
    (payload.id!=="portal-preference"&&payload.id!=="god-session-rpc"))
  return forwardMainSource(request,c.env)
 const actor=await sourceReadSession(request,c.env)
 if(!actor.ok)return c.json({error:"view_data_unavailable"},actor.status)
 if(payload.id==="god-session-rpc")
  return attachSourceCookies(await godSourceReadResponse(
   actor.db as unknown as ReadDb,actor.cookieHeader,payload.args),actor)
 return attachSourceCookies(portalPreferenceResponse(actor.cookieHeader),actor)
})

app.post("/api/auth/portal-login",c=>forwardMainAuth(c.req.raw,c.env))
app.post("/api/auth/account-action",c=>forwardMainAuth(c.req.raw,c.env))
app.get("/auth/callback",c=>forwardMainAuth(c.req.raw,c.env))

app.get("/api/v1/session",async c=>{
 const header=c.req.header("Authorization")||""
 const match=/^Bearer ([A-Za-z0-9._~+\/-]{30,8192})$/.exec(header)
 if(!match)return c.json({error:"authentication_required"},401)
 const url=c.env.SUPABASE_URL,key=c.env.SUPABASE_ANON_KEY
 if(!url||!key)return c.json({error:"service_unconfigured"},503)
 // ANON key only: never service-role. Each request uses its own verified token
 // for PostgREST RLS. Never cache a user-scoped Supabase client globally.
 const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+match[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const {data:verified,error:claimsError}=await db.auth.getClaims(match[1])
 if(claimsError||!verified?.claims?.sub)return c.json({error:"authentication_required"},401)
 const {data:rows,error}=await db.rpc("upt_current_session_context")
 if(error)return c.json({error:"identity_unavailable"},503)
 const identity=parseIdentity(Array.isArray(rows)?rows[0]:null)
 if(!identity||identity.id!==verified.claims.sub||!isActive(identity))
  return c.json({error:"access_denied"},403)
 return c.json({id:identity.id,role:identity.role,effectiveRole:identity.effective_role,owner:identity.is_owner})
})

// Verified per-request identity: never trust browser-supplied roles. The
// publishable Supabase key is used with the current signed user's JWT only.
async function scopedActor(c:{req:{header:(key:string)=>string|undefined};env:Bindings}){
 const auth=c.req.header("Authorization")||""
 const match=/^Bearer ([A-Za-z0-9._~+-]{30,8192})$/.exec(auth)
 if(!match)return {error:"authentication_required" as const,status:401 as const}
 if(!c.env.SUPABASE_URL||!c.env.SUPABASE_ANON_KEY)
  return {error:"service_unconfigured" as const,status:503 as const}
 const db=createClient(c.env.SUPABASE_URL,c.env.SUPABASE_ANON_KEY,{
  global:{headers:{Authorization:"Bearer "+match[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 })
 const {data:claims,error:claimsError}=await db.auth.getClaims(match[1])
 if(claimsError||!claims?.claims?.sub)return {error:"authentication_required" as const,status:401 as const}
 const {data:context,error}=await db.rpc("upt_current_session_context")
 if(error)return {error:"identity_unavailable" as const,status:503 as const}
 const identity=parseIdentity(Array.isArray(context)?context[0]:null)
 if(!identity||identity.id!==claims.claims.sub||!isActive(identity))
  return {error:"access_denied" as const,status:403 as const}
 return {db,identity}
}
const safeText=(value:unknown,max=180)=>typeof value==="string"?value.slice(0,max):null
const validList=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.filter(x=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x)).slice(0,25) as Record<string,unknown>[]:[]

app.get("/api/v1/integrations/status",async c=>{
 const actor=await scopedActor(c)
 if("error" in actor)return c.json({error:actor.error},actor.status)
 const {data:allowed,error:accessError}=await actor.db.rpc("upt_can_manage_integrations")
 if(accessError)return c.json({error:"permission_check_unavailable"},503)
 if(allowed!==true)return c.json({error:"access_denied"},403)
 const {data:configuration,error}=await actor.db.rpc("upt_integration_credentials",{p_action:"list"})
 if(error||!Array.isArray(configuration))return c.json({error:"integration_status_unavailable"},503)
 // Explicit metadata allowlist: no ciphertext, tokens or provider credentials.
 const accepted=new Set(["weeztix","sumup","peppol","banking","documenso"])
 const configured=validList(configuration).filter(x=>accepted.has(String(x.provider)))
  .map(x=>({provider:x.provider,updatedAt:safeText(x.updated_at,60)}))
 return c.json({configured,connectionFlow:"requires_configured_provider_oauth",
  oauthReady:{
   sumup:oauthReady(c.env,"sumup",c.req.url),
   peppol:oauthReady(c.env,"peppol",c.req.url)
  }
 })
})


// Bounded JSON input; do not buffer attacker-controlled request bodies.
async function boundedJson(request:Request,limit=4096):Promise<Record<string,unknown>|null>{
 if(!request.body)return null
 const length=request.headers.get("content-length")
 if(length&&(!/^\d+$/.test(length)||Number(length)>limit))return null
 const chunks:Uint8Array[]=[];let bytes=0
 const reader=request.body.getReader()
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   bytes+=value.byteLength
   if(bytes>limit){await reader.cancel().catch(()=>{});return null}
   chunks.push(value)
  }
 }catch{return null}
 finally{reader.releaseLock()}
 const merged=new Uint8Array(bytes);let offset=0
 for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}
 try{
  const result:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(merged))
  return result&&typeof result==="object"&&!Array.isArray(result)?result as Record<string,unknown>:null
 }catch{return null}
}
async function managedOauthActor(c:Parameters<typeof scopedActor>[0]){
 const actor=await scopedActor(c)
 if("error" in actor)return actor
 const {data:allowed,error}=await actor.db.rpc("upt_can_manage_integrations")
 if(error)return {error:"integration_permission_unavailable" as const,status:503 as const}
 if(allowed!==true)return {error:"access_denied" as const,status:403 as const}
 return actor
}
// POST only: Authorization bearer + Origin must match the operator-configured
// HTTPS origin. OAuth client secrets and encryption keys never leave Worker.
app.post("/api/v1/integrations/oauth/start",async c=>{
 const actor=await managedOauthActor(c)
 if("error" in actor)return c.json({error:actor.error},actor.status)
 const body=await boundedJson(c.req.raw)
 if(!body||!isOAuthProvider(body.provider))return c.json({error:"invalid_provider"},422)
 const provider=body.provider
 if(!oauthReady(c.env,provider,c.req.url))return c.json({error:"oauth_not_configured"},503)
 const origin=oauthOrigin(c.env,c.req.url)
 if(!origin||c.req.header("Origin")!==origin)return c.json({error:"origin_denied"},403)
 const master=c.env.UPT_INTEGRATION_ENCRYPTION_KEY!
 const {state,cookie}=await startOAuthState(provider,actor.identity.id,master)
 const url=authorizationUrl(c.env,provider,origin,state)
 c.header("Set-Cookie",cookie)
 return c.json({authorizeUrl:url})
})

app.post("/api/v1/integrations/oauth/complete",async c=>{
 const actor=await managedOauthActor(c)
 if("error" in actor)return c.json({error:actor.error},actor.status)
 const body=await boundedJson(c.req.raw)
 if(!body||!isOAuthProvider(body.provider))return c.json({error:"invalid_provider"},422)
 const provider=body.provider
 if(!oauthReady(c.env,provider,c.req.url))return c.json({error:"oauth_not_configured"},503)
 const origin=oauthOrigin(c.env,c.req.url)
 if(!origin||c.req.header("Origin")!==origin)return c.json({error:"origin_denied"},403)
 // Invalidate the browser's OAuth state regardless of any downstream failure.
 c.header("Set-Cookie",clearOAuthCookie(provider))
 if(typeof body.state!=="string"||typeof body.code!=="string"||
  !(await verifyOAuthState(provider,actor.identity.id,c.env.UPT_INTEGRATION_ENCRYPTION_KEY!,
   c.req.header("Cookie")||"",body.state)))
  return c.json({error:"oauth_state_denied"},403)
 const token=await exchangeOAuthCode(c.env,provider,body.code,origin)
 if(!token)return c.json({error:"provider_token_unavailable"},502)
 const ciphertext=await sealOAuthToken(provider,tokenConfiguration(provider,token,c.env),
  c.env.UPT_INTEGRATION_ENCRYPTION_KEY!)
 // The existing SECURITY DEFINER RPC checks current admin/administration role,
 // audits every change and stores ciphertext in its private table. Never
 // store provider tokens in browser cookies, logs or service-worker cache.
 const {data,error}=await actor.db.rpc("upt_integration_credentials",{
  p_action:"save",p_provider:provider,p_ciphertext:ciphertext
 })
 if(error||!data||typeof data!=="object"||(data as Record<string,unknown>).configured!==true)
  return c.json({error:"integration_save_unconfirmed"},503)
 return c.json({connected:true})
})

app.get("/api/v1/god/diagnostics",async c=>{
 const actor=await scopedActor(c)
 if("error" in actor)return c.json({error:actor.error},actor.status)
 // Technical Maker does not receive business/financial integration authority.
 if(!actor.identity.is_owner)return c.json({error:"access_denied"},403)
 const {data:owner,error:ownerError}=await actor.db.rpc("upt_current_is_owner")
 if(ownerError)return c.json({error:"maker_check_unavailable"},503)
 if(owner!==true)return c.json({error:"access_denied"},403)
 // Ephemeral God token exists on the Worker stack ONLY for this one request.
 // Never serialize it to JSON, use browser storage or place it in a cookie.
 const {data:token,error:loginError}=await actor.db.rpc("upt_god_login_owner")
 if(loginError||typeof token!=="string"||!token)return c.json({error:"maker_session_unavailable"},503)
 try{
  const {data:snapshot,error}=await actor.db.rpc("upt_god_maker_log_snapshot",{p_token:token,p_limit:20})
  if(error||!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))
   return c.json({error:"diagnostics_unavailable"},503)
  const row=snapshot as Record<string,unknown>
  // No raw stack traces, metadata, client context, secrets or personal IDs.
  return c.json({
   audit:validList(row.audit).map(x=>({
    action:safeText(x.action,80),entityType:safeText(x.entity_type,80),
    at:safeText(x.created_at,60)
   })),
   recovery:validList(row.recovery).map(x=>({
    type:safeText(x.check_type,80),status:safeText(x.status,45),
    at:safeText(x.checked_at,60)
   })),
   errors:validList(row.errors).map(x=>({
    name:sanitizedMakerName(x.error_name),route:sanitizedMakerRoute(x.route),
    status:safeText(x.status,45),severity:sanitizedMakerSeverity(x.ai_severity),
    needsMaker:x.maker_action_required===true,
    count:typeof x.reported_count==="number"?x.reported_count:null,
    at:safeText(x.created_at,60)
   }))
  })
 }finally{
  // Session token must be invalidated even on a failed database read.
  try{await actor.db.rpc("upt_god_logout",{p_token:token})}catch{/* Never disclose privileged token. */}
 }
})


// Ticket admission is a mutating provider operation, never an offline QR
// acceptance. The operator must explicitly enable both scanner endpoints and
// the exact Main HTTPS origin; the user must be authenticated and assigned to
// an entrance workplace, independently verified by Postgres.
app.post("/api/v1/tickets/weeztix/scan",async c=>{
 const header=c.req.header("Authorization")||""
 if(!/^Bearer [A-Za-z0-9._~+-]{30,8192}$/.test(header))
  return c.json({ok:false,code:"unauthorized"},401)
 if(!scannerReady(c.env,c.req.url))
  return c.json({ok:false,code:"scanner_disabled"},503)
 const origin=scannerOrigin(c.env,c.req.url)
 if(!origin||c.req.header("Origin")!==origin)
  return c.json({ok:false,code:"forbidden"},403)
 if(!c.req.header("Content-Type")?.toLowerCase().startsWith("application/json"))
  return c.json({ok:false,code:"invalid_request"},415)
 const body=await boundedJson(c.req.raw,1024)
 if(!validScanRequest(body))return c.json({ok:false,code:"invalid_request"},422)
 const actor=await scopedActor(c)
 if("error" in actor)return c.json({ok:false,code:actor.error==="authentication_required"?"unauthorized":"forbidden"},actor.status)
 const out=await scanWeeztix(actor.db as unknown as RpcDb,c.env,body)
 return c.json(out.body,out.status as 200|403|404|409|422|503)
})

// First source-identical admin action wave. The browser hint is only a
// streaming-safe selector: the signed action _id, authenticated session,
// original admin/approved RPCs and original SQL RLS are checked separately.
// No POST is available on deployed Main-QA (write flag is always false).
app.post("/api/migration/actions",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const hint=c.req.header("x-uptilldawn-action-hint")||null
 const waveOne=nativeAdminActionAllowed(hint)
 const waveTwo=nativeWaveTwoAllowed(hint)
 const waveThree=nativeWaveThreeAllowed(hint)
 const waveFour=nativeInventoryActionAllowed(hint)
 if(!waveOne&&!waveTwo&&!waveThree&&!waveFour)
  return forwardMainSource(c.req.raw,c.env)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return Response.json({
  error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",
  code:actor.status===401?"authentication_required":"action_unavailable"
 },{status:actor.status,headers:{"Cache-Control":"private, no-store"}})
 const db=actor.db as unknown as NativeAdminActionDb
 const result=waveOne
  ?await nativeAdminActionResponse(c.req.raw,db,hint)
  :waveTwo
   ?await nativeWaveTwoActionResponse(c.req.raw,db,hint as Parameters<typeof nativeWaveTwoActionResponse>[2])
   :waveThree
    ?await nativeWaveThreeActionResponse(c.req.raw,db,hint as Parameters<typeof nativeWaveThreeActionResponse>[2])
    :await nativeInventoryActionResponse(c.req.raw,db,hint as Parameters<typeof nativeInventoryActionResponse>[2])
 return attachSourceCookies(result,actor)
})

// Candidate is intentionally read-only. Vite compile-time flags alone are
// not security controls: clients can POST directly to the original Main API
// service binding. Enforce the migration gate at the Worker boundary too.
// /api/migration/view-data uses POST for a scoped READ and is the sole
// exception. Login/account actions above retain their own original-auth
// security contract; provider OAuth and ticket admission remain separately OFF.
app.all("/api/*",c=>{
 const path=c.req.path,method=c.req.method
 if(path==="/api/test-auth-session"||!originalApiAllowed(path,method))return c.json({error:"not_found"},404)
 const readMethod=method==="GET"||method==="HEAD"
 const safeReadPost=path==="/api/migration/view-data"&&method==="POST"
 // OAuth authorization/callback GETs can initiate account linkage and
 // set state cookies. Peppol XML readiness GET is a pure original Main read
 // and stays available, preserving its existing behavior.
 const businessGet=method==="GET"&&
  /^\/api\/administration\/integrations\/(?:oauth\/[^/]+|weeztix)\/(?:start|callback)$/.test(path)
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true"&&(!readMethod&&!safeReadPost||businessGet))
  return c.json({error:"migration_writes_disabled"},503)
 return forwardMainSource(c.req.raw,c.env)
})
// Original portal switching and private contract downloads are server routes,
// not SPA pages. Other artist URLs serve the static index through ASSETS.
app.all("/portals/*",c=>{
 const path=new URL(c.req.url).pathname
 if(originalApiAllowed(path,c.req.method))return forwardMainSource(c.req.raw,c.env)
 if(c.req.method==="GET"&&path.startsWith("/portals/administration/modules/artists/")&&c.env.ASSETS)return c.env.ASSETS.fetch(new Request(new URL("/index.html",c.req.url),{headers:{Accept:"text/html"}}))
 return c.json({error:"not_found"},404)
})

// Deny unknown API routes rather than returning the SPA shell with 200 OK.
app.notFound(c=>c.json({error:"not_found"},404))
app.onError((_error,c)=>c.json({error:"internal_error"},500))
export default app
