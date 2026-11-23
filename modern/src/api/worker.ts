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
import {nativeRosterActionAllowed,nativeRosterActionResponse} from "./native-roster-handover-actions.ts"
import {nativeCatalogActionAllowed,nativeCatalogActionResponse} from "./native-catalog-event-actions.ts"
import {megaPeopleAllowed,megaPeopleResponse} from "./native-mega-people-actions.ts"
import {megaOperationsAllowed,megaOperationsResponse} from "./native-mega-operations-actions.ts"
import {megaCrewEventAllowed,megaCrewEventResponse} from "./native-mega-crew-event-actions.ts"
import {megaMakerAllowed,megaMakerResponse,godLogoutId,originalGodLogout} from "./native-mega-maker-actions.ts"
import {nativeWaveNineAllowed,nativeWaveNineResponse} from "./native-wave-nine-safe-actions.ts"
import {finalCrewActionAllowed,finalCrewActionResponse} from "./native-final-crew-actions.ts"
import {finalOperationsActionAllowed,finalOperationsActionResponse} from "./native-final-operations-actions.ts"
import {finalAdminDetailsAllowed,finalAdminDetailsResponse} from "./native-final-admin-details.ts"
import {finalFinanceActionAllowed,finalFinanceResponse} from "./native-final-finance-actions.ts"
import {finalAgreementsAllowed,finalAgreementsResponse} from "./native-final-agreements-actions.ts"
import {nativeBankStatementRegister,nativeProviderSettlementRegister} from "./native-bank-settlement-registers.ts"
import {nativeBankStatementImport,nativeBankStatementReview,nativeProviderSettlementApprove} from "./native-bank-settlement-writes.ts"
import {nativeAdministrationPermission,nativeFinancialAttachment,nativePeppolPreparation} from "./native-admin-document-routes.ts"
import {nativeBookingNotesGet,nativeBookingNotesPost} from "./native-booking-notes.ts"
import {nativePushSubscription,nativeTranslateChat,type NativeTranslationAI} from "./native-push-translation.ts"
import {nativeProviderMappingCreate,nativeProviderMappingUpdate,nativeProviderTransactionsImport} from "./native-provider-mutations.ts"
import {nativeInvoiceLinesImport,nativeTicketSalesImport} from "./native-final-imports.ts"
import {nativeBookingNotesProposal,nativeAdministrationAssistant,nativeOperationalAdminAssistant} from "./native-final-ai-assistants.ts"
import {nativeArtistContractArchive,nativeArtistContractPrint} from "./native-artist-agreements.ts"
import {nativeUserErrorReportPost} from "./native-error-ingest.ts"
import {nativeBriefingMediaExtract} from "./native-briefing-media.ts"
import {nativeGodPreviewRolePost,nativeGodRulesPost} from "./native-maker-writes.ts"
import {makerObservabilityResponse} from "./native-maker-observability.ts"
import {nativeMakerStudioReadResponse} from "./native-maker-studio-reads.ts"
import {nativeIntegrationsSummary} from "./native-integration-read.ts"
import {nativeMakerSourcePost} from "./native-maker-source-post.ts"
import {nativeMakerSqlPost} from "./native-maker-sql-post.ts"
import {nativeMakerAiProposal} from "./native-maker-ai-proposals.ts"
import {nativeMakerTextExecution} from "./native-maker-text-execution.ts"
import {nativeWeeztixSourceScan} from "./native-weeztix-original-scan.ts"
import {nativeMakerBusinessResponse} from "./native-maker-business-writes.ts"
import {nativeIntegrationMutation} from "./native-integration-mutations.ts"
import {nativePontoGet,nativePontoPost} from "./native-ponto-integration.ts"
import {nativeProviderConnectionCheck} from "./native-provider-connection.ts"
import {nativeFinanceExportResponse} from "./native-finance-export.ts"
import {nativeGuestlistImport,type GuestlistAI} from "./native-original-guestlist.ts"
import {nativeSalesXlsx,nativeWorkSessionsXlsx} from "./native-original-xlsx-exports.ts"
import {nativeOriginalProviderOAuth,nativeOriginalWeeztixOAuth} from "./native-original-provider-oauth.ts"
import {nativePortalSwitchResponse,nativeFacebookEventResponse,nativeGeoapifyAutocompleteResponse} from "./native-standalone-routes.ts"

type Bindings={SUPABASE_URL:string;SUPABASE_ANON_KEY:string;UPT_WEEZTIX_OAUTH_ORIGIN?:string;CONTRACT_ISSUER_EMAIL?:string;CLOUDFLARE_OBSERVABILITY_CONFIG?:string;AI?:NativeTranslationAI;UPT_MIGRATION_ALLOW_WRITES?:string;GEOAPIFY_API_KEY?:string;DOCUMENSO_API_KEY?:string;DOCUMENSO_BASE_URL?:string;ASSETS?:{fetch:(request:Request)=>Promise<Response>}}&OAuthBindings&ScannerBindings&MainAuthBindings
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
 if(c.env.UPT_MIGRATION_NATIVE_AUTH_ENABLED==="true")
  c.header("X-UpTillDawn-Auth-Protocol","native-direct-v1")
 else if(c.env.MAIN_AUTH_RUNTIME)
  c.header('X-UpTillDawn-Auth-Protocol','main-auth-native-v1')
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
// Three signed, read-only original Maker observability routes. Never forward
// the QA or production JWT to a different Supabase project; management secrets
// stay private and cross-environment reads remain manually authorized.
for(const path of ["/api/god/logs","/api/god/platform-logs","/api/god/cloudflare-logs"] as const){
 app.get(path,async c=>{
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await makerObservabilityResponse(
   actor.db,c.req.raw,actor.cookieHeader,c.env,path
  ),actor)
 })
}
// Two original Maker Studio read endpoints now run natively without Next.
// The original GitHub source editor writes, SQL execution and production
// switching remain on their separately secured, explicitly gated paths.
for(const path of ["/api/god/source","/api/god/sql","/api/god/overview"] as const){
 app.get(path,async c=>{
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await nativeMakerStudioReadResponse(
   actor.db,c.req.raw,actor.cookieHeader,c.env,path
  ),actor)
 })
}

// Original Maker mutations: signed Supabase actor + expiring private God
// session + the source SQL permission/RLS gates. Public QA writes are stopped
// before cookie validation, GitHub calls or database mutations.
for(const [path,kind] of [
 ["/api/god/automation-rules","automation"],
 ["/api/god/data","data"],
 ["/api/god/error-reports","report"],
 ["/api/god/connection","connect"]
] as const){
 app.post(path,async c=>{
  if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
   return c.json({error:"migration_writes_disabled"},503)
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await nativeMakerBusinessResponse(
   actor.db,c.req.raw,actor.cookieHeader,c.env,kind
  ),actor)
 })
}
app.delete("/api/god/connection",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
 return attachSourceCookies(await nativeMakerBusinessResponse(
  actor.db,c.req.raw,actor.cookieHeader,c.env,"disconnect"
 ),actor)
})

// Native God Mode studio: original source proposals and SQL queries remain
// separately Maker-authenticated and are stopped BEFORE any I/O on QA.
// Code and UI editor AI only return reviewable proposals and cannot commit.
for(const [path,kind] of [
 ["/api/god/source","source"],
 ["/api/god/sql","sql"]
] as const){
 app.post(path,async c=>{
  if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
   return c.json({error:"migration_writes_disabled"},503)
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await (kind==="source"
   ?nativeMakerSourcePost(actor.db,c.req.raw,actor.cookieHeader,c.env)
   :nativeMakerSqlPost(actor.db,c.req.raw,actor.cookieHeader,c.env)),actor)
 })
}
for(const [path,kind] of [
 ["/api/god/code-assistant","code"],
 ["/api/edit-assistant","edit"]
] as const){
 app.post(path,async c=>{
  // Both operations produce uncommitted proposals, never mutate data.
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"God Mode sessie vereist."},actor.status)
  return attachSourceCookies(await nativeMakerAiProposal(
   actor.db,c.req.raw,actor.cookieHeader,c.env,kind,c.env.AI
  ),actor)
 })
}

// Complete original natural-language two-stage Maker proposal. It can mark
// reports as working, so it is gated on isolated QA until reviewed acceptance.
app.post("/api/god/text-execution",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
 return attachSourceCookies(await nativeMakerTextExecution(
  actor.db,c.req.raw,actor.cookieHeader,c.env,c.env.AI
 ),actor)
})

// Existing original browser-facing scan path. Never bypass the independent
// PWA scanner flag, signed user and scoped SQL event/workplace authorization.
app.post("/api/weeztix/scan",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 if(c.env.UPT_MIGRATION_SCANNING_ENABLED!=="true")
  return c.json({ok:false,code:"not_configured"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({ok:false,code:actor.status===401?"unauthorized":"forbidden"},actor.status)
 return attachSourceCookies(await nativeWeeztixSourceScan(
  actor.db,actor.identity,c.req.raw,c.env
 ),actor)
})

app.get("/api/error-reports",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await userErrorReportReadResponse(
  actor.db as unknown as ReadDb,c.req.raw),actor)
})

// Exact read-only original endpoints now execute without the legacy Worker.
// Customer-configurable connection metadata and recent audit, no credentials.
// Native GET only. Provider credential writes/OAuth are disabled on Main QA.
app.get("/api/administration/integrations",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"forbidden"},actor.status)
 return attachSourceCookies(await nativeIntegrationsSummary(
  actor.db,c.req.raw,c.env
 ),actor)
})

// Customer-managed provider configuration: original encrypted SQL vault,
// role verification and mandatory same-origin check. No public QA mutations.
for(const method of ["POST","DELETE"] as const){
 const handler=async (request:Request,env:Bindings)=>{
  if(env.UPT_MIGRATION_ALLOW_WRITES!=="true")
   return Response.json({error:"migration_writes_disabled"},{status:503})
  const actor=await sourceReadSession(request,env)
  if(!actor.ok)return Response.json({error:"forbidden"},{status:actor.status})
  return attachSourceCookies(await nativeIntegrationMutation(
   actor.db,request,env,method
  ),actor)
 }
 if(method==="POST")app.post("/api/administration/integrations",c=>handler(c.req.raw,c.env))
 else app.delete("/api/administration/integrations",c=>handler(c.req.raw,c.env))
}

// Ponto AIS and four-provider connection validation are run in the isolated
// Worker, never by a privileged Next service hop. Financial POSTs always
// require the explicit migration QA write gate before database/provider I/O.
app.get("/api/administration/integrations/ponto",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"access_denied"},actor.status)
 return attachSourceCookies(await nativePontoGet(actor.db,c.env),actor)
})
app.post("/api/administration/integrations/ponto",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"access_denied"},actor.status)
 return attachSourceCookies(await nativePontoPost(actor.db,c.req.raw,c.env),actor)
})
app.post("/api/admin/provider-connection-check",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({status:"unavailable",error:"unauthorized"},actor.status)
 return attachSourceCookies(await nativeProviderConnectionCheck(actor.db,c.req.raw,c.env),actor)
})

// Original customer-facing GET OAuth consent and callback URLs. Both start
// and callback mutate browser/vault state; never treat GET as a safe QA read.
// No legacy Worker, provider request or SQL writes while QA gates are off.
for(const [path,phase] of [
 ["/api/administration/integrations/oauth/:provider/start","start"],
 ["/api/administration/integrations/oauth/:provider/callback","callback"]
] as const){
 app.get(path,async c=>{
  if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true"||
     c.env.UPT_MIGRATION_OAUTH_ENABLED!=="true")
   return c.json({error:"migration_writes_disabled"},503)
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"forbidden"},actor.status)
  return attachSourceCookies(await nativeOriginalProviderOAuth(
   actor.db,actor.identity.id,c.req.raw,c.env,c.req.param("provider"),phase
  ),actor)
 })
}
for(const [path,phase] of [
 ["/api/administration/integrations/weeztix/start","start"],
 ["/api/administration/integrations/weeztix/callback","callback"]
] as const){
 app.get(path,async c=>{
  if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true"||
     c.env.UPT_MIGRATION_OAUTH_ENABLED!=="true")
   return c.json({error:"migration_writes_disabled"},503)
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"forbidden"},actor.status)
  return attachSourceCookies(await nativeOriginalWeeztixOAuth(
   actor.db,actor.identity.id,c.req.raw,c.env,phase
  ),actor)
 })
}

// All original guestlist input types: CSV/TXT/XLSX are Worker-local;
// rich documents use the existing optional Cloudflare AI (no new paid API).
// Original admin-only SQL privilege and input limits are repeated natively.
app.post("/api/guestlist/import",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativeGuestlistImport(
  actor.db,c.req.raw,c.env.AI as GuestlistAI|undefined
 ),actor)
})

// Original Excel exports now run on the signed, RLS-scoped Hono Worker.
app.get("/api/uptilldawn/export",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return new Response("Aanmelden vereist.",{status:actor.status})
 return attachSourceCookies(await nativeWorkSessionsXlsx(actor.db,actor.identity.id),actor)
})
app.get("/api/uptilldawn/sales-export",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return new Response("Aanmelden vereist.",{status:actor.status})
 return attachSourceCookies(await nativeSalesXlsx(actor.db,c.req.raw,actor.identity.id),actor)
})
app.get("/api/administration/finance/export",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:actor.status===401?"Unauthorized":"Service unavailable"},actor.status)
 return attachSourceCookies(await nativeFinanceExportResponse(actor.db,actor.identity),actor)
})
app.get("/api/facebook-event",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativeFacebookEventResponse(actor.db,actor.identity,c.req.raw),actor)
})
app.get("/api/geocode/autocomplete",async c=>{
 // Keep 1:1 existing autocomplete until an identical private provider key
 // has been installed on this Worker. Never silently turn results into [].
 if(!c.env.GEOAPIFY_API_KEY)return forwardMainSource(c.req.raw,c.env)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativeGeoapifyAutocompleteResponse(
  actor.db,c.req.raw,c.env.GEOAPIFY_API_KEY
 ),actor)
})
app.get("/portals/switch/:portal",async c=>{
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return new Response(null,{status:307,headers:{
  Location:"/login","Cache-Control":"private, no-store"
 }})
 return attachSourceCookies(await nativePortalSwitchResponse(
  actor.db,actor.identity,c.req.raw,c.req.param("portal")
 ),actor)
})

// Native backend wave: original URLs and DTOs, no Next/legacy calls.
// Every admin operation verifies a fresh signed SSR session and database
// permission. Disabled QA writes are rejected BEFORE signing or SQL.
const adminRoute=async(
 request:Request,env:Bindings,
 execute:(db:import("@supabase/supabase-js").SupabaseClient,actorId:string)=>Promise<Response>,
 mutation=false
):Promise<Response>=>{
 if(mutation&&env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return Response.json({error:"migration_writes_disabled"},{status:503})
 const actor=await sourceReadSession(request,env)
 if(!actor.ok)return Response.json({error:"access_denied"},{status:actor.status})
 const permitted=await nativeAdministrationPermission(actor.db)
 if(permitted!==200)return attachSourceCookies(
  Response.json({error:"access_denied"},{status:permitted}),actor)
 return attachSourceCookies(await execute(actor.db,actor.identity.id),actor)
}
// Source-preserved imports and three bounded AI assistants. All POSTs
// remain blocked on public Main-QA until transaction and per-role acceptance.
// Original artist agreements are private NON-SPA routes. A browser that
// is not logged in is redirected to the same original login UI, not served
// a blank static shell. Every file is authorized with signed SQL & Storage RLS.
const artistAgreementRoute=async(
 req:Request,env:Bindings,
 handler:(db:import("@supabase/supabase-js").SupabaseClient)=>Promise<Response>
):Promise<Response>=>{
 const actor=await sourceReadSession(req,env)
 if(!actor.ok){
  if(actor.status===503)return Response.json({error:"access_unavailable"},{status:503})
  return new Response(null,{status:307,headers:{
   Location:"/login","Cache-Control":"private, no-store"
  }})
 }
 const permission=await nativeAdministrationPermission(actor.db)
 if(permission===503)return Response.json({error:"access_unavailable"},{status:503})
 if(permission!==200)return new Response(null,{status:307,headers:{
  Location:"/portals","Cache-Control":"private, no-store"
 }})
 return attachSourceCookies(await handler(actor.db),actor)
}
app.get("/portals/administration/modules/artists/:id/agreement/archive/:versionId",c=>
 artistAgreementRoute(c.req.raw,c.env,db=>nativeArtistContractArchive(
  db,c.req.raw,c.req.param("id"),c.req.param("versionId")
 )))
app.get("/portals/administration/modules/artists/:id/agreement/print/:versionId",c=>
 artistAgreementRoute(c.req.raw,c.env,db=>nativeArtistContractPrint(
  db,c.req.param("id"),c.req.param("versionId"),c.env.CONTRACT_ISSUER_EMAIL
 )))
app.post("/api/error-reports",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 let schedule:((job:Promise<unknown>)=>void)|undefined
 try{const runtime=c.executionCtx;schedule=job=>runtime.waitUntil(job)}catch{}
 return attachSourceCookies(await nativeUserErrorReportPost(
  actor.db,c.req.raw,c.env.AI,schedule
 ),actor)
})
// No cloud document conversion, no OpenAI/Cloudmersive dependency: Office
// images remain parsed locally with bounded ZIP inflate and signed role checks.
// Maker edits can never be unlocked by selecting a preview role.
// The second original God session token is revalidated with the owner RPC
// for every POST, besides the ordinary signed SSR identity.
for(const [path,handler] of [
 ["/api/god/preview-role",nativeGodPreviewRolePost],
 ["/api/god/rules",nativeGodRulesPost]
] as const){
 app.post(path,async c=>{
  if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
   return c.json({error:"migration_writes_disabled"},503)
  const actor=await sourceReadSession(c.req.raw,c.env)
  if(!actor.ok)return c.json({error:"Meld opnieuw aan bij God Mode."},actor.status)
  return attachSourceCookies(await handler(
   actor.db,c.req.raw,actor.cookieHeader
  ),actor)
 })
}
app.post("/api/briefing-extract-media",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Niet ingelogd."},actor.status)
 const [profileResult,roleResult]=await Promise.all([
  actor.db.from("profiles").select("role,approved").eq("id",actor.identity.id).single(),
  actor.db.rpc("upt_current_effective_role")
 ])
 const role=roleResult.data||profileResult.data?.role
 if(profileResult.error||roleResult.error||!profileResult.data?.approved||
    !["admin","responsible_lead"].includes(role||""))
  return c.json({error:"Geen toegang."},403)
 return attachSourceCookies(await nativeBriefingMediaExtract(c.req.raw),actor)
})
app.post("/api/administration/finance/invoice-lines/import",c=>
 adminRoute(c.req.raw,c.env,db=>nativeInvoiceLinesImport(db,c.req.raw),true))
app.post("/api/administration/ticketing/import",c=>
 adminRoute(c.req.raw,c.env,db=>nativeTicketSalesImport(db,c.req.raw),true))
app.post("/api/administration/assistant/booking-notes/propose",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBookingNotesProposal(db,c.req.raw,c.env.AI),true))
app.post("/api/administration/assistant",c=>
 adminRoute(c.req.raw,c.env,db=>nativeAdministrationAssistant(db,c.req.raw,c.env.AI),true))
app.post("/api/admin-assistant",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 const {data:admin,error}=await actor.db.rpc("upt_is_admin",{uid:actor.identity.id})
 if(error)return c.json({error:"Toegangscontrole tijdelijk niet beschikbaar."},503)
 if(admin!==true)return c.json({error:"Geen toegang."},403)
 return attachSourceCookies(await nativeOperationalAdminAssistant(
  actor.db,c.req.raw,c.env.AI
 ),actor)
})
app.post("/api/administration/provider-mappings",c=>
 adminRoute(c.req.raw,c.env,(db,actorId)=>nativeProviderMappingCreate(db,actorId,c.req.raw),true))
app.patch("/api/administration/provider-mappings/:id",c=>
 adminRoute(c.req.raw,c.env,db=>nativeProviderMappingUpdate(db,c.req.param("id"),c.req.raw),true))
app.post("/api/administration/provider-transactions",c=>
 adminRoute(c.req.raw,c.env,db=>nativeProviderTransactionsImport(db,c.req.raw),true))
app.get("/api/administration/bank-statements",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBankStatementRegister(db)))
app.post("/api/administration/bank-statements",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBankStatementImport(db,c.req.raw),true))
app.patch("/api/administration/bank-statements",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBankStatementReview(db,c.req.raw),true))
app.get("/api/administration/provider-settlements",c=>
 adminRoute(c.req.raw,c.env,db=>nativeProviderSettlementRegister(db)))
app.post("/api/administration/provider-settlements",c=>
 adminRoute(c.req.raw,c.env,db=>nativeProviderSettlementApprove(db,c.req.raw),true))
app.get("/api/administration/finance/attachments/:id",c=>
 adminRoute(c.req.raw,c.env,db=>nativeFinancialAttachment(db,c.req.param("id"))))
app.get("/api/administration/peppol/prepare",c=>
 adminRoute(c.req.raw,c.env,db=>nativePeppolPreparation(db,c.req.raw,false)))
// Read-only XML generation by POST; signed + CSRF checked, no database writes.
app.post("/api/administration/peppol/prepare",c=>
 adminRoute(c.req.raw,c.env,db=>nativePeppolPreparation(db,c.req.raw,true)))
app.get("/api/administration/assistant/booking-notes",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBookingNotesGet(db,c.req.raw)))
app.post("/api/administration/assistant/booking-notes",c=>
 adminRoute(c.req.raw,c.env,db=>nativeBookingNotesPost(db,c.req.raw),true))
app.post("/api/push/subscription",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativePushSubscription(actor.db,c.req.raw,"POST"),actor)
})
app.delete("/api/push/subscription",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativePushSubscription(actor.db,c.req.raw,"DELETE"),actor)
})
app.post("/api/translate-chat",async c=>{
 if(c.env.UPT_MIGRATION_ALLOW_WRITES!=="true")
  return c.json({error:"migration_writes_disabled"},503)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok)return c.json({error:"Aanmelden vereist."},actor.status)
 return attachSourceCookies(await nativeTranslateChat(c.req.raw,c.env.AI),actor)
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

// Compiled original Admin direct login route preserves its native 303,
// signed role/owner gates and Supabase chunked cookies without Next.
app.post("/api/auth/admin-login",c=>forwardMainAuth(c.req.raw,c.env))
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
 const waveFive=nativeRosterActionAllowed(hint)
 const waveSix=nativeCatalogActionAllowed(hint)
 const waveSevenPeople=megaPeopleAllowed(hint)
 const waveSevenOperations=megaOperationsAllowed(hint)
 const waveEightCrew=megaCrewEventAllowed(hint)
 const waveEightMaker=megaMakerAllowed(hint)
 const waveNine=nativeWaveNineAllowed(hint)
 const finalCrew=finalCrewActionAllowed(hint)
 const finalOperations=finalOperationsActionAllowed(hint)
 const finalDetails=finalAdminDetailsAllowed(hint)
 const finalFinance=finalFinanceActionAllowed(hint)
 const finalAgreements=finalAgreementsAllowed(hint)
 if(!waveOne&&!waveTwo&&!waveThree&&!waveFour&&!waveFive&&!waveSix&&!waveSevenPeople&&!waveSevenOperations&&!waveEightCrew&&!waveEightMaker&&!waveNine&&!finalCrew&&!finalOperations&&!finalDetails&&!finalFinance&&!finalAgreements)
  // Every original action has a native handler. A miss is unknown or
  // forged: do NOT dispatch it to a privileged Next backend even in QA.
  return c.json({error:"unknown_action"},404)
 const actor=await sourceReadSession(c.req.raw,c.env)
 if(!actor.ok){
  // Original God Mode logout clears privileged cookies even after the
  // ordinary auth session expires. Keep the existing same-origin + _id checks.
  if(hint===godLogoutId&&actor.status===401)
   return originalGodLogout(c.req.raw,null)
  return Response.json({
   error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",
   code:actor.status===401?"authentication_required":"action_unavailable"
  },{status:actor.status,headers:{"Cache-Control":"private, no-store"}})
 }
 const db=actor.db as unknown as NativeAdminActionDb
 if(finalCrew)return attachSourceCookies(await finalCrewActionResponse(c.req.raw,db,hint as Parameters<typeof finalCrewActionResponse>[2],c.env.GEOAPIFY_API_KEY||""),actor)
 if(finalOperations)return attachSourceCookies(await finalOperationsActionResponse(c.req.raw,db,hint as Parameters<typeof finalOperationsActionResponse>[2]),actor)
 if(finalDetails)return attachSourceCookies(await finalAdminDetailsResponse(c.req.raw,db,hint as Parameters<typeof finalAdminDetailsResponse>[2]),actor)
 if(finalFinance)return attachSourceCookies(await finalFinanceResponse(c.req.raw,db,hint as Parameters<typeof finalFinanceResponse>[2]),actor)
 if(finalAgreements)return attachSourceCookies(await finalAgreementsResponse(c.req.raw,db,hint as Parameters<typeof finalAgreementsResponse>[2],{
  DOCUMENSO_API_KEY:c.env.DOCUMENSO_API_KEY,DOCUMENSO_BASE_URL:c.env.DOCUMENSO_BASE_URL
 }),actor)
 if(waveNine)return attachSourceCookies(await nativeWaveNineResponse(c.req.raw,db,hint as Parameters<typeof nativeWaveNineResponse>[2]),actor)
 const result=waveOne
  ?await nativeAdminActionResponse(c.req.raw,db,hint)
  :waveTwo
   ?await nativeWaveTwoActionResponse(c.req.raw,db,hint as Parameters<typeof nativeWaveTwoActionResponse>[2])
   :waveThree
    ?await nativeWaveThreeActionResponse(c.req.raw,db,hint as Parameters<typeof nativeWaveThreeActionResponse>[2])
    :waveFour
     ?await nativeInventoryActionResponse(c.req.raw,db,hint as Parameters<typeof nativeInventoryActionResponse>[2])
     :waveFive
      ?await nativeRosterActionResponse(c.req.raw,db,hint as Parameters<typeof nativeRosterActionResponse>[2])
      :waveSix
       ?await nativeCatalogActionResponse(c.req.raw,db,hint as Parameters<typeof nativeCatalogActionResponse>[2])
       :waveSevenPeople
        ?await megaPeopleResponse(c.req.raw,db,hint as Parameters<typeof megaPeopleResponse>[2])
        :waveSevenOperations
         ?await megaOperationsResponse(c.req.raw,db,hint as Parameters<typeof megaOperationsResponse>[2])
         :waveEightCrew
          ?await megaCrewEventResponse(c.req.raw,db,hint as Parameters<typeof megaCrewEventResponse>[2])
          :await megaMakerResponse(c.req.raw,db,hint as Parameters<typeof megaMakerResponse>[2])
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
