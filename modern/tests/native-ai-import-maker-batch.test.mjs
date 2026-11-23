import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeTicketCsvImport,nativeInvoiceLinesImport} from "../src/api/native-invoice-ticket-imports.ts"
import {nativeAdminAssistant,nativeAdministrationAssistant,nativeBookingNotesProposal} from "../src/api/native-ai-assistants.ts"
import {nativeGodPreviewRolePost,nativeGodRulesPost} from "../src/api/native-maker-writes.ts"
import {nativeClientErrorReport} from "../src/api/native-error-reporting.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const uuid="11111111-1111-4111-8111-111111111111"
const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
 SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false"}
const request=(path,method="POST",body="{}",headers={})=>new Request(origin+path,{
 method,headers:{"Origin":origin,"Sec-Fetch-Site":"same-origin",
  ...(typeof body==="string"?{"Content-Type":"application/json"}:{}),...headers},body
})
test("all eight extracted POST APIs are blocked on public Main-QA before database or legacy Worker",async()=>{
 const paths=[
  "/api/administration/finance/invoice-lines/import",
  "/api/administration/ticketing/import",
  "/api/administration/assistant",
  "/api/administration/assistant/booking-notes/propose",
  "/api/admin-assistant",
  "/api/god/preview-role",
  "/api/god/rules",
  "/api/error-reports"
 ]
 let forwarded=0
 const e={...env,MAIN_AUTH:{fetch:async()=>{forwarded++;throw Error("FORBIDDEN_LEGACY")}}}
 for(const path of paths){
  const response=await app.request(request(path),{},e)
  assert.equal(response.status,503,path)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"},path)
 }
 assert.equal(forwarded,0)
})
test("enabling private QA write gate never promotes unsigned identities or proxies an action",async()=>{
 let forwarded=0
 const e={...env,UPT_MIGRATION_ALLOW_WRITES:"true",MAIN_AUTH:{
  fetch:async()=>{forwarded++;throw Error("FORBIDDEN_LEGACY")}
 }}
 for(const path of [
  "/api/admin-assistant","/api/administration/assistant",
  "/api/administration/ticketing/import","/api/god/rules","/api/error-reports"
 ]){
  const response=await app.request(request(path),{},e)
  assert.equal(response.status,401,path)
 }
 assert.equal(forwarded,0)
})
test("CSV invoice and ticket imports reject unauthenticated origin and malformed bounded uploads before SQL",async()=>{
 const db={from:()=>{throw Error("No DB calls for invalid file")},rpc:()=>{throw Error("No SQL writes")}}
 const malicious=new Request(origin+"/api/administration/ticketing/import",{
  method:"POST",headers:{Origin:"https://evil.invalid"},body:new FormData()
 })
 assert.equal((await nativeTicketCsvImport(db,malicious)).status,403)
 assert.equal((await nativeInvoiceLinesImport(db,malicious)).status,403)
 assert.equal((await nativeTicketCsvImport(db,request("/api/administration/ticketing/import","POST",new FormData()))).status,422)
 assert.equal((await nativeInvoiceLinesImport(db,request("/api/administration/finance/invoice-lines/import","POST",new FormData()))).status,422)
})
test("Admin AI verifies SQL Admin authorization before parsing untrusted content or using provider AI",async()=>{
 let calls=0
 const denied={rpc:async name=>{assert.equal(name,"upt_is_admin");return {data:false,error:null}},
  from:()=>{throw Error("No Admin data read")}}
 const provider={run:async()=>{calls++;throw Error("Should not run")}}
 const res=await nativeAdminAssistant(denied,request("/api/admin-assistant"),provider,uuid)
 assert.equal(res.status,403)
 assert.equal(calls,0)
 const deniedSource={rpc:async()=>({data:true,error:{code:"DENIED"}})}
 assert.equal((await nativeAdminAssistant(deniedSource,request("/api/admin-assistant"),provider,uuid)).status,503)
 const allowed={rpc:async()=>({data:true,error:null}),from:()=>{throw Error("Invalid request must not query data")}}
 assert.equal((await nativeAdminAssistant(allowed,request("/api/admin-assistant"),provider,uuid)).status,400)
 assert.equal(calls,0)
})
test("Administration assistant and booking proposals validate strict locale and user request before AI",async()=>{
 let queries=0
 const db={from:()=>{queries++;throw Error("No data for invalid request")}}
 const badLocale=request("/api/administration/assistant","POST",JSON.stringify({
  message:"Hallo",locale:"xx",history:[]
 }))
 assert.equal((await nativeAdministrationAssistant(db,badLocale,undefined)).status,400)
 const badNotes=request("/api/administration/assistant/booking-notes/propose","POST",JSON.stringify({
  bookingId:uuid,expectedNotes:null,instruction:"edit",locale:"nl"
 }))
 assert.equal((await nativeBookingNotesProposal(db,badNotes,undefined)).status,400)
 assert.equal(queries,0)
})
test("God Mode editor requires a signed God cookie, verified session and owner",async()=>{
 let ownerQueries=0,mutations=0
 const db={rpc:async (name)=>{
  if(name==="upt_god_session_valid")return {data:false,error:null}
  if(name==="upt_current_is_owner"){ownerQueries++;return {data:true,error:null}}
  mutations++;throw Error("unauthorized")
 }}
 const r=request("/api/god/preview-role","POST",JSON.stringify({role:"admin"}))
 const noCookie=await nativeGodPreviewRolePost(db,r,"")
 assert.equal(noCookie.status,401)
 assert.equal(mutations,0)
 const fakeCookie=await nativeGodPreviewRolePost(db,request("/api/god/preview-role","POST",JSON.stringify({role:"admin"})),
  "uptilldawn-god-session=not-a-signed-session")
 assert.equal(fakeCookie.status,401)
 assert.equal(mutations,0)
 assert.ok(ownerQueries<=1)
 const fakeRules=await nativeGodRulesPost(db,request("/api/god/rules","POST",JSON.stringify({role:"admin",rules:[]})),
  "uptilldawn-god-session=not-a-signed-session")
 assert.equal(fakeRules.status,401)
 assert.equal(mutations,0)
})
test("God Mode editor preserves verified original role and rule normalization, no duplicate privileges",async()=>{
 const seen=[]
 const db={rpc:async (name,args)=>{
  seen.push([name,args])
  if(name==="upt_god_session_valid"||name==="upt_current_is_owner")return {data:true,error:null}
  if(name==="upt_set_admin_role_mode")return {data:args.p_role,error:null}
  if(name==="upt_god_save_role_rules")return {data:true,error:null}
  throw Error("unexpected RPC")
 }}
 const cookie="uptilldawn-god-session=verified-fixture"
 const preview=await nativeGodPreviewRolePost(db,request("/api/god/preview-role","POST",JSON.stringify({role:"responsible_lead"})),cookie)
 assert.deepEqual(await preview.json(),{ok:true,role:"responsible_lead"})
 const bad=await nativeGodRulesPost(db,request("/api/god/rules","POST",JSON.stringify({role:"admin",rules:[{role:"staff"}]})),cookie)
 assert.equal(bad.status,400)
 const rule={role:"staff",feature_key:"crew",label:"Crew",group_key:"crew",
  visible:true,enabled:true,condition_key:"always",sort_order:900}
 const result=await nativeGodRulesPost(db,request("/api/god/rules","POST",JSON.stringify({role:"admin",rules:[rule]})),cookie)
 assert.equal(result.status,200)
 const body=await result.json()
 assert.equal(body.rules[0].role,"admin")
 assert.equal(body.rules[0].sort_order,10)
 assert.equal(seen.filter(x=>x[0]==="upt_god_save_role_rules").length,1)
})
test("Error reporting respects approved session, strict bounded body and never starts AI on invalid input",async()=>{
 let writes=0
 const deny={rpc:async name=>{assert.equal(name,"upt_is_approved");return {data:false,error:null}}}
 assert.equal((await nativeClientErrorReport(deny,request("/api/error-reports"),undefined,undefined)).status,401)
 const allowed={rpc:async name=>{
  if(name==="upt_is_approved")return {data:true,error:null}
  writes++;throw Error("Unexpected mutation")
 }}
 const invalid=await nativeClientErrorReport(allowed,request("/api/error-reports"),undefined,undefined)
 assert.equal(invalid.status,400)
 const oversize=await nativeClientErrorReport(allowed,request("/api/error-reports","POST",JSON.stringify({
  route:"/test",errorMessage:"X".repeat(40000)
 })),undefined,undefined)
 assert.equal(oversize.status,413)
 assert.equal(writes,0)
})
