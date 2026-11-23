import test from "node:test"
import assert from "node:assert/strict"
import {createHash} from "node:crypto"
import {report} from "../scripts/legacy-route-audit.mjs"
import app from "../src/api/worker.ts"
import {nativeInvoiceLinesImport,nativeTicketSalesImport} from "../src/api/native-final-imports.ts"
import {nativeBookingNotesProposal,nativeAdministrationAssistant,nativeOperationalAdminAssistant}
 from "../src/api/native-final-ai-assistants.ts"
import {nativeArtistContractArchive,nativeArtistContractPrint} from "../src/api/native-artist-agreements.ts"
import {nativeUserErrorReportPost} from "../src/api/native-error-ingest.ts"
import {nativeBriefingMediaExtract} from "../src/api/native-briefing-media.ts"
import {nativeGodPreviewRolePost,nativeGodRulesPost} from "../src/api/native-maker-writes.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const uuid="11111111-1111-4111-8111-111111111111"
const makeRequest=(path,method="POST",body="{}",headers={})=>
 new Request(origin+path,{method,headers:{
  Origin:origin,"Sec-Fetch-Site":"same-origin",
  ...typeof body==="string"&&method!=="GET"&&method!=="HEAD"?{"Content-Type":"application/json"}:{},
  ...headers
 },...(method==="GET"||method==="HEAD"?{}:{body})})
function signed(request){return new Request(request.url,{method:request.method,
 headers:{...Object.fromEntries(request.headers),Origin:origin},
 body:request.body,duplex:"half"})}
const dbNone={from:()=>{throw Error("No DB access before bounded validation")},
 rpc:async()=>{throw Error("No RPC access before bounded validation")}}
test("64 original API route/method contracts tracked and explicit legacy routes cannot be misreported as finished",()=>{
 assert.equal(report.originalSourceRoutes,64)
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.ok(report.originalMethodPairs>=64)
 assert.ok(report.nativeMethodPairs>=25)
 assert.ok(report.pendingLegacyMethodPairs>0)
 assert.equal(report.fullCutoverAllowed,false)
 for(const path of [
  "/api/administration/finance/invoice-lines/import",
  "/api/administration/ticketing/import",
  "/api/administration/assistant/booking-notes/propose",
  "/api/administration/assistant",
  "/api/admin-assistant",
  "/api/error-reports",
  "/portals/administration/modules/artists/[^/]+/agreement/print/[^/]+",
  "/portals/administration/modules/artists/[^/]+/agreement/archive/[^/]+",
  "/api/briefing-extract-media",
  "/api/god/preview-role",
  "/api/god/rules"
 ]){
  assert.ok(report.pending.every(x=>!x.startsWith("POST "+path+" ")&&!x.startsWith("GET "+path+" ")),path)
 }
 assert.ok(report.pending.some(x=>x.includes("integrations/oauth")))
 assert.ok(report.pending.every(x=>!x.includes("/api/god/")),"God routes must remain native")
 assert.ok(report.pending.some(x=>x.includes("/api/guestlist/import")),"Guestlist import still needs a native route")
 assert.ok(report.pending.some(x=>x.includes("/api/uptilldawn/export")),"Excel work-session export is not migrated yet")
})
test("finance invoice-line import rejects cross-origin and malformed CSV before SQL",async()=>{
 const x=new Request(origin+"/api/administration/finance/invoice-lines/import",{
  method:"POST",headers:{Origin:"https://evil.invalid","Content-Type":"multipart/form-data"},body:"evil"
 })
 assert.equal((await nativeInvoiceLinesImport(dbNone,x)).status,403)
 const res=await nativeInvoiceLinesImport(dbNone,makeRequest(
  "/api/administration/finance/invoice-lines/import","POST",new FormData()))
 assert.equal(res.status,422)
 assert.deepEqual(await res.json(),{error:"invalid_import_request"})
})
test("ticket sales CSV validates event, source, and file without SQL or external provider API",async()=>{
 const fd=new FormData()
 fd.set("file",new File(["ticket_id,quantity"],"sales.csv",{type:"text/csv"}))
 fd.set("eventId","bad")
 fd.set("source","sumup")
 const res=await nativeTicketSalesImport(dbNone,makeRequest(
  "/api/administration/ticketing/import","POST",fd))
 assert.equal(res.status,422)
 assert.deepEqual(await res.json(),{error:"invalid_target"})
 const cross=new Request(origin+"/api/administration/ticketing/import",{
  method:"POST",headers:{Origin:"https://evil.invalid","Content-Type":"application/json"},body:"{}"
 })
 assert.equal((await nativeTicketSalesImport(dbNone,cross)).status,403)
})
test("artist booking AI protects immutable communications and excludes financial/identity changes",async()=>{
 const request=(instruction)=>makeRequest("/api/administration/assistant/booking-notes/propose",
 "POST",JSON.stringify({
  bookingId:uuid,expectedNotes:"Previous notes",instruction,locale:"nl"
 }))
 let aiCalls=0
 const db={from:()=>({
  select:()=>({eq:()=>({maybeSingle:async()=>({data:{
   id:uuid,status:"confirmed",internal_notes:"Previous notes"
  },error:null})})})
 })}
 const blocked=await nativeBookingNotesProposal(db,request("Change the IBAN bank account for payment"),{
  run:async()=>{aiCalls++;throw Error("sensitive request must not touch AI")}
 })
 assert.equal(blocked.status,422)
 assert.equal(aiCalls,0)
 const invalid=await nativeBookingNotesProposal(db,request("a"),undefined)
 assert.equal(invalid.status,400)
})
test("administration and operational AI reject invalid input and cross-site calls without reading DB",async()=>{
 const a=await nativeAdministrationAssistant(dbNone,makeRequest(
  "/api/administration/assistant","POST",JSON.stringify({message:"x",locale:"jp"})),undefined)
 assert.equal(a.status,400)
 const o=await nativeOperationalAdminAssistant(dbNone,makeRequest(
  "/api/admin-assistant","POST",JSON.stringify({message:"",locale:"nl"})),undefined)
 assert.equal(o.status,400)
 for(const run of [
  (req)=>nativeAdministrationAssistant(dbNone,req,undefined),
  (req)=>nativeOperationalAdminAssistant(dbNone,req,undefined)
 ]){
  const bad=new Request(origin+"/api/admin-assistant",{method:"POST",
   headers:{Origin:"https://evil.invalid","Content-Type":"application/json"},body:"{}"})
  assert.equal((await run(bad)).status,403)
 }
})
test("artist contract print preserves original cryptographic digest, output escaping and content headers",async()=>{
 const snapshot={
  agreement_payment_terms:"Payment 30 days",
  agreement_cancellation_terms:"Cancellations agreed",
  agreement_liability_terms:"Each party responsible",
  agreement_governing_law:"Belgian law",
  event_name:"Event <script>alert(1)</script>",
  event_start_at:"2026-11-24T20:00:00Z",agency_name:"Agency & Co",
  agency_email:"agent@example.org",currency:"EUR",fee_amount:200
 }
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({
  maybeSingle:async()=>({data:{id:uuid,version_number:1,snapshot,
   approved_at:"2026-11-20T12:00:00Z"},error:null})
 })})})})}
 const out=await nativeArtistContractPrint(db,uuid,uuid)
 assert.equal(out.status,200)
 assert.match(out.headers.get("content-type"),/text\/html/)
 assert.match(out.headers.get("x-contract-sha256"),/^[a-f0-9]{64}$/)
 const body=await out.text()
 assert.ok(body.includes("&lt;script&gt;"))
 assert.ok(!body.includes("<script>"))
 assert.equal((await nativeArtistContractPrint(db,"../etc",uuid)).status,404)
})
test("private contract archive rejects mismatched SHA even if Storage would serve the object",async()=>{
 const pdf=new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n")
 const hash=createHash("sha256").update(pdf).digest("hex")
 const path="artist/"+uuid+"/v1/signed-"+hash+".pdf"
 let reads=0
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({
  maybeSingle:async()=>({data:{id:uuid,version_number:1,approved_at:"2026-11-20T12:00:00Z"},error:null})
 })})})}),storage:{from:()=>({download:async()=>{
  reads++;return {data:new Blob([pdf]),error:null}
 }})}}
 const ok=await nativeArtistContractArchive(db,makeRequest(
  "/portals/administration/modules/artists/"+uuid+"/agreement/archive/"+uuid+"?path="+encodeURIComponent(path),"GET",undefined
 ),uuid,uuid)
 assert.equal(ok.status,200);assert.deepEqual(new Uint8Array(await ok.arrayBuffer()),pdf)
 assert.equal(reads,1)
 const badPath="artist/"+uuid+"/v1/signed-"+"a".repeat(64)+".pdf"
 const denied=await nativeArtistContractArchive(db,makeRequest(
  "/portals/administration/modules/artists/"+uuid+"/agreement/archive/"+uuid+"?path="+encodeURIComponent(badPath),"GET",undefined
 ),uuid,uuid)
 assert.equal(denied.status,404)
})
test("native error report uses source schema and fails closed before SQL when not approved",async()=>{
 const unapproved={rpc:async()=>({data:false,error:null})}
 const notAllowed=await nativeUserErrorReportPost(unapproved,makeRequest(
  "/api/error-reports","POST",JSON.stringify({route:"/events",errorMessage:"Failed"})
 ),undefined)
 assert.equal(notAllowed.status,401)
 const approved={rpc:async()=>({data:true,error:null})}
 const malformed=await nativeUserErrorReportPost(approved,makeRequest(
  "/api/error-reports","POST",JSON.stringify({route:"",errorMessage:""})
 ),undefined)
 assert.equal(malformed.status,400)
 const calls=[]
 const id=uuid
 const valid={rpc:async(name)=>{
  calls.push(name)
  if(name==="upt_is_approved")return {data:true,error:null}
  if(name==="upt_report_client_error")return {data:{id,deduplicated:true},error:null}
  if(name==="upt_start_error_report_ai")return {data:false,error:null}
  throw Error("unexpected "+name)
 }}
 const tasks=[]
 const accepted=await nativeUserErrorReportPost(valid,makeRequest(
  "/api/error-reports","POST",JSON.stringify({
   route:"/events",errorName:"TypeError",errorMessage:"An error",
   source:"runtime"
  })
 ),undefined,promise=>tasks.push(promise))
 assert.equal(accepted.status,202)
 assert.equal((await accepted.json()).deduplicated,true)
 await Promise.all(tasks)
 assert.deepEqual(calls,["upt_is_approved","upt_report_client_error","upt_start_error_report_ai"])
})
test("local briefing media uses original MIME contract and rejects unsafe Office content",async()=>{
 const regular=new FormData()
 regular.set("file",new File(["hello"],"notes.txt",{type:"text/plain"}))
 const text=await nativeBriefingMediaExtract(makeRequest(
  "/api/briefing-extract-media","POST",regular))
 assert.equal(text.status,200)
 assert.deepEqual(await text.json(),{images:[]})
 const zip=new FormData()
 zip.set("file",new File(["NOT A ZIP"],"brief.docx",{
  type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 }))
 const invalid=await nativeBriefingMediaExtract(makeRequest(
  "/api/briefing-extract-media","POST",zip))
 assert.equal(invalid.status,400)
})
test("public Main-QA denies all new POSTs before any legacy service, actor or SQL use",async()=>{
 let calls=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",UPT_MIGRATION_NATIVE_AUTH_ENABLED:"false",
  MAIN_AUTH:{fetch:async()=>{calls++;throw Error("unexpected legacy request")}}}
 const paths=[
  "/api/administration/finance/invoice-lines/import",
  "/api/administration/ticketing/import",
  "/api/administration/assistant/booking-notes/propose",
  "/api/administration/assistant",
  "/api/admin-assistant",
  "/api/error-reports",
  "/api/briefing-extract-media"
 ]
 for(const path of paths){
  const r=await app.request(makeRequest(path),{},env)
  assert.equal(r.status,503,path)
  assert.deepEqual(await r.json(),{error:"migration_writes_disabled"},path)
 }
 for(const path of ["print","archive"]){
  const res=await app.request(origin+"/portals/administration/modules/artists/"+uuid+
   "/agreement/"+path+"/"+uuid,{},env)
  assert.equal(res.status,307,path)
  assert.equal(res.headers.get("location"),"/login")
 }
 assert.equal(calls,0)
})

test("Maker role preview and rule edits require both independent God session and owner status",async()=>{
 const request=(path,body)=>makeRequest(path,"POST",JSON.stringify(body),{
  Cookie:"uptilldawn-god-session=fixture-strong-token"
 })
 let writes=0
 const db={rpc:async(name,args)=>{
  if(name==="upt_god_session_valid")return {data:true,error:null}
  if(name==="upt_current_is_owner")return {data:true,error:null}
  writes++
  if(name==="upt_set_admin_role_mode")return {data:args.p_role,error:null}
  if(name==="upt_god_save_role_rules")return {data:null,error:null}
  throw Error("unexpected RPC "+name)
 }}
 const valid=await nativeGodPreviewRolePost(db,request(
  "/api/god/preview-role",{role:"staff"}
 ),"uptilldawn-god-session=fixture-strong-token")
 assert.equal(valid.status,200)
 assert.deepEqual(await valid.json(),{ok:true,role:"staff"})
 const denied=await nativeGodPreviewRolePost(db,request(
  "/api/god/preview-role",{role:"maker"}
 ),"uptilldawn-god-session=fixture-strong-token")
 assert.equal(denied.status,400)
 const edited=await nativeGodRulesPost(db,request(
  "/api/god/rules",{role:"staff",rules:[]}
 ),"uptilldawn-god-session=fixture-strong-token")
 assert.equal(edited.status,200)
 assert.deepEqual(await edited.json(),{ok:true,rules:[]})
 assert.equal(writes,2)
 const noCookie=await nativeGodPreviewRolePost(db,request(
  "/api/god/preview-role",{role:"admin"}
 ),"")
 assert.equal(noCookie.status,401)
 assert.equal(writes,2)
 const nonOwner={rpc:async name=>({data:name==="upt_god_session_valid",error:null})}
 const noOwner=await nativeGodRulesPost(nonOwner,request(
  "/api/god/rules",{role:"staff",rules:[]}
 ),"uptilldawn-god-session=fixture-strong-token")
 assert.equal(noOwner.status,403)
})
