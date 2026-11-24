import test from "node:test"
import assert from "node:assert/strict"
import {nativeOriginalViewData,signingConnectionView} from "../src/api/native-original-view-data.ts"
import {report} from "../scripts/legacy-route-audit.mjs"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const uuid="11111111-1111-4111-8111-111111111111"
const other="22222222-2222-4222-8222-222222222222"
const identity={id:uuid,role:"staff",approved:true,account_blocked:false,
 is_owner:false,effective_role:null,full_name:null}
const request=(id,args=[],headers={})=>new Request(origin+"/api/migration/view-data",{
 method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
 body:JSON.stringify({id,args})
})
function fixture({portal=true,granted=true}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push([name,args])
  if(name==="upt_my_portal_assignments")return {data:portal?[{
   portal:"administration",role:"administrative_staff",approved:true,revoked_at:null
  }]:[],error:null}
  if(name==="upt_can_manage_integrations")return {data:granted,error:null}
  if(name==="upt_integration_credentials")return {data:[{provider:"sumup",updated_at:"2026-01-01"}],error:null}
  if(name==="upt_god_session_valid")return {data:true,error:null}
  if(name==="upt_current_is_owner")return {data:true,error:null}
  throw Error("Unexpected RPC "+name)
 },from:(table)=>{
  calls.push(["from",table])
  if(table==="events")return {select:()=>({order:()=>({limit:async()=>({
   data:[{id:other,name:"Rave"}],error:null
  })})})}
  if(table==="admin_artist_agreement_versions")return {select:()=>({
   eq:()=>({eq:()=>({maybeSingle:async()=>({
    data:{id:other,version_number:2,approved_at:null},error:null
   })})})
  })}
  if(table==="administration_contract_signing_requests")return {select:()=>({
   eq:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({
    data:null,error:null
   })})})})
  })}
  throw Error("Unexpected table "+table)
 }}
 return {db,calls}
}
test("source endpoint fully native; cutover remains explicitly blocked",()=>{
 assert.ok(!report.pending.some(x=>x.includes("/api/migration/view-data")))
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.equal(report.fullCutoverAllowed,false)
})
test("portal preference retains exact original cookies and does not query SQL",async()=>{
 const f=fixture()
 const response=await nativeOriginalViewData(f.db,identity,request("portal-preference"),
  "uptilldawn-last-portal=promotion",{})
 assert.deepEqual(await response.json(),{value:{lastPortal:"promotion"}})
 assert.deepEqual(f.calls,[])
 for(const fake of ["admin","god","//bad"]){
  const r=await nativeOriginalViewData(f.db,identity,request("portal-preference"),
   "uptilldawn-last-portal="+fake,{})
  assert.deepEqual(await r.json(),{value:{lastPortal:null}})
 }
})
test("non-Administration staff can view only sales integration status and no secrets",async()=>{
 const f=fixture({portal:false})
 const env={SUMUP_API_KEY:"private",SUMUP_MERCHANT_CODE:"merchant",PONTO_CLIENT_ID:"p"}
 const sales=await nativeOriginalViewData(f.db,identity,request("external-services",["sales"]),"",env)
 const payload=await sales.json()
 assert.deepEqual(payload.value.map(v=>v.id),["sumup","eventpay"])
 assert.equal(payload.value[0].state,"credentials_present")
 assert.ok(!JSON.stringify(payload).includes("private"))
 const denied=await nativeOriginalViewData(f.db,identity,request("external-services",["banking"]),"",env)
 assert.equal(denied.status,403)
 const view=await nativeOriginalViewData(f.db,identity,
  request("external-services-view",[[{id:"sumup"},{id:"eventpay"}]]),"",env)
 assert.deepEqual(await view.json(),{value:{
  access:{ok:false},lookup:{available:false,rows:[]},events:null,
  oauthStorageReady:false,weeztixReady:false,oauthReady:{sumup:false,peppol:false}
 }})
 assert.ok(!f.calls.some(([name])=>name==="upt_integration_credentials"))
 const deniedView=await nativeOriginalViewData(f.db,identity,
  request("external-services-view",[[{id:"banking"}]]),"",env)
 assert.equal(deniedView.status,403)
})
test("Administration integration view returns only scoped public metadata",async()=>{
 const f=fixture()
 const env={
  UPT_INTEGRATION_ENCRYPTION_KEY:btoa("a".repeat(32)),
  UPT_WEEZTIX_OAUTH_CLIENT_ID:"client",UPT_WEEZTIX_OAUTH_CLIENT_SECRET:"secret",
  UPT_SUMUP_OAUTH_CLIENT_ID:"client",UPT_SUMUP_OAUTH_CLIENT_SECRET:"secret",
  UPT_BILLIT_OAUTH_CLIENT_ID:"billit",UPT_BILLIT_OAUTH_CLIENT_SECRET:"billit"
 }
 const r=await nativeOriginalViewData(f.db,identity,
  request("external-services-view",[[{id:"weeztix"},{id:"sumup"},{id:"peppol"}]]),"",env)
 assert.equal(r.status,200)
 const data=(await r.json()).value
 assert.deepEqual(data.lookup,{available:true,rows:[{provider:"sumup"}]})
 assert.deepEqual(data.events,{data:[{id:other,name:"Rave"}],error:null})
 assert.equal(data.oauthStorageReady,true)
 assert.equal(data.weeztixReady,true)
 assert.deepEqual(data.oauthReady,{sumup:true,peppol:true})
 assert.ok(!JSON.stringify(data).includes(env.UPT_INTEGRATION_ENCRYPTION_KEY))
 assert.ok(f.calls.some(([name])=>name==="upt_can_manage_integrations"))
})
test("signing connection remains not configured without private server values",async()=>{
 const f=fixture()
 const r=await nativeOriginalViewData(f.db,identity,request("signing-connection"),"",{})
 assert.deepEqual(await r.json(),{value:{
  configured:false,healthy:false,certificateReady:false,reason:"not_configured"
 }})
 const direct=await signingConnectionView({
  DOCUMENSO_BASE_URL:"http://localhost:8080/",DOCUMENSO_API_KEY:"secret"
 })
 assert.equal(direct.configured,false)
})
test("signing preflight validates IDs, RLS and reports read-only blocked dispatch",async()=>{
 const f=fixture()
 const invalid=await nativeOriginalViewData(f.db,identity,request("artist-signing-preflight",[
  {bookingId:"../not-a-uuid",agreementVersionId:other}
 ]),"",{})
 assert.equal(invalid.status,400)
 const r=await nativeOriginalViewData(f.db,identity,request("artist-signing-preflight",[
  {bookingId:uuid,agreementVersionId:other}
 ]),"",{})
 assert.deepEqual(await r.json(),{value:{
  ready:false,reasons:["approval_missing","signing_request_missing",
   "dispatch_disabled","archive_verification_required"],status:null
 }})
 assert.ok(f.calls.some(([name,table])=>name==="from"&&table===
  "administration_contract_signing_requests"))
 const no=fixture({portal:false})
 const denied=await nativeOriginalViewData(no.db,identity,request("artist-signing-preflight",[
  {bookingId:uuid,agreementVersionId:other}
 ]),"",{})
 assert.equal(denied.status,403)
 assert.ok(!no.calls.some(([name])=>name==="from"))
})
test("unknown IDs, oversized, invalid and cross-site requests never reach SQL",async()=>{
 const f=fixture()
 for(const req of [new Request(origin+"/api/migration/view-data",{
  method:"POST",headers:{Origin:origin,"Content-Type":"text/plain"},body:"no"
 }),request("portal-preference",[],{Origin:"https://evil.invalid"}),
 request("portal-preference",[],{"Sec-Fetch-Site":"cross-site"})]){
  const r=await nativeOriginalViewData(f.db,identity,req,"",{})
  assert.ok([400,403].includes(r.status))
 }
 assert.deepEqual(f.calls,[])
 const unknown=await nativeOriginalViewData(f.db,{...identity,role:"admin"},
  request("no-such-id"),"",{})
 assert.equal(unknown.status,404)
})
