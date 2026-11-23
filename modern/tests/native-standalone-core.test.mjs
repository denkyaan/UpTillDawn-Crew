import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativePortalSwitchResponse,nativeFacebookEventResponse,
 nativeGeoapifyAutocompleteResponse,normalizeGeoapifyRow} from "../src/api/native-standalone-routes.ts"
import {nativeFinanceExportResponse} from "../src/api/native-finance-export.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const admin="11111111-1111-4111-8111-111111111111"
const signed=(role="staff",owner=false)=>({
 id:admin,full_name:"QA",role,effective_role:null,
 approved:true,account_blocked:false,is_owner:owner
})
const candidate={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
 SUPABASE_ANON_KEY:"sb_publishable_test",UPT_MIGRATION_ALLOW_WRITES:"false"}

test("native portal switch preserves source destinations, secure cookie and signed roles",async()=>{
 const calls=[]
 const db={rpc:async name=>{
  calls.push(name)
  return {data:[{portal:"promotion",role:"promoter",approved:true,revoked_at:null}],error:null}
 }}
 const promo=await nativePortalSwitchResponse(db,signed(),new Request(origin+"/portals/switch/promotion"),"promotion")
 assert.equal(promo.status,307)
 assert.equal(promo.headers.get("location"),"/portals/promotion")
 assert.match(promo.headers.get("set-cookie"),/uptilldawn-last-portal=promotion/)
 assert.match(promo.headers.get("set-cookie"),/HttpOnly/i)
 assert.match(promo.headers.get("set-cookie"),/Secure/i)
 assert.match(promo.headers.get("set-cookie"),/SameSite=Lax/i)
 const event=await nativePortalSwitchResponse(db,signed(),new Request(origin+"/portals/switch/events"),"events")
 assert.equal(event.headers.get("location"),"/")
 assert.deepEqual(calls,["upt_my_portal_assignments","upt_my_portal_assignments"])
 const unknown=await nativePortalSwitchResponse(db,signed(),new Request(origin+"/portals/switch/../admin"),"../admin")
 assert.equal(unknown.headers.get("location"),"/portals")
 assert.equal(unknown.headers.has("set-cookie"),false)
})
test("portal switch fails closed on broken delegated role lookup, but permanent Admin/Owner survives",async()=>{
 const unavailable={rpc:async()=>({data:null,error:{code:"DENIED"}})}
 const url=new Request(origin+"/portals/switch/promotion")
 const staff=await nativePortalSwitchResponse(unavailable,signed("staff"),url,"promotion")
 assert.equal(staff.headers.get("location"),"/portals")
 assert.equal(staff.headers.has("set-cookie"),false)
 for(const identity of [signed("admin"),signed("staff",true)]){
  const response=await nativePortalSwitchResponse(unavailable,identity,url,"promotion")
  assert.equal(response.headers.get("location"),"/portals/promotion")
 }
 const blocked={...signed(),account_blocked:true}
 assert.equal((await nativePortalSwitchResponse(unavailable,blocked,url,"events")).headers.get("location"),"/portals")
})
test("Facebook metadata rejects non-admin before fetching and invalid public URLs remain source 422",async()=>{
 const calls=[]
 const db={rpc:async(name)=>{
  calls.push(name)
  return {data:name==="upt_is_admin"?true:true,error:null}
 }}
 const denied={rpc:async name=>({data:name==="upt_is_admin"?false:true,error:null})}
 const url=new Request(origin+"/api/facebook-event?url=https://internal.invalid/")
 assert.equal((await nativeFacebookEventResponse(denied,signed(),url)).status,403)
 const response=await nativeFacebookEventResponse(db,signed("admin"),url)
 assert.equal(response.status,422)
 assert.match((await response.json()).error,/Facebook/)
 assert.deepEqual(calls.sort(),["upt_is_admin","upt_is_approved"])
})
test("Geoapify input normalization and database rate-limits preserve old contract",async()=>{
 assert.deepEqual(normalizeGeoapifyRow({lat:50.8,lon:4.7,street:"Kerkstraat",
  housenumber:"7",country_code:"be",city:"Leuven",formatted:"Kerkstraat 7"},0),{
  id:"50.8:4.7:0",name:"Kerkstraat 7",formatted:"Kerkstraat 7",
  addressLine1:"Kerkstraat 7",addressLine2:"",latitude:50.8,longitude:4.7,
  resultType:"unknown",streetAddress:"Kerkstraat 7",postalCode:"",city:"Leuven",
  countryCode:"BE"
 })
 assert.equal(normalizeGeoapifyRow({lat:Infinity,lon:4},0),null)
 const allowed={rpc:async name=>({data:name==="upt_is_approved"?true:{allowed:true},error:null})}
 const noProvider=await nativeGeoapifyAutocompleteResponse(
  allowed,new Request(origin+"/api/geocode/autocomplete?q=X"),"dummy")
 assert.deepEqual(await noProvider.json(),{results:[]})
 const denied={rpc:async name=>({data:name==="upt_is_approved"?true:{allowed:false,retry_after:32},error:null})}
 const rate=await nativeGeoapifyAutocompleteResponse(
  denied,new Request(origin+"/api/geocode/autocomplete?q=Leuven"),"dummy")
 assert.equal(rate.status,429)
 assert.equal(rate.headers.get("retry-after"),"32")
 const fail={rpc:async name=>({data:null,error:name==="upt_geoapify_rate_limit"?{code:"NO"}:null})}
 assert.equal((await nativeGeoapifyAutocompleteResponse(
  fail,new Request(origin+"/api/geocode/autocomplete?q=Leuven"),"dummy")).status,503)
})
test("finance export computes exact-cent balance and retains CSV formula escaping",async()=>{
 const doc={id:"inv-1",kind:"sales_invoice",document_number:"=CMD",status:"issued",
  currency:"EUR",gross_amount:12.1,due_date:"2025-01-01",issue_date:"2024-12-01",original_invoice_id:null}
 const payment={id:"payment-1",document_id:"inv-1",amount:2.1}
 const db={
  rpc:async()=>({data:[{portal:"administration",role:"administrative_staff",approved:true,revoked_at:null}],error:null}),
  from:table=>{
   const q={select:()=>q,order:()=>q,range:async()=>{
    const data=table==="admin_financial_documents"?[doc]:[payment]
    return {data,error:null,count:1}
   }}
   return q
  }
 }
 const response=await nativeFinanceExportResponse(db,signed("staff"))
 assert.equal(response.status,200)
 assert.match(response.headers.get("content-type"),/text\/csv/)
 const csv=await response.text()
 assert.ok(csv.startsWith("\uFEFF"))
 assert.match(csv,/'=CMD/)
 assert.match(csv,/10\.00/)
 assert.match(csv,/0\.00/)
 const noAccess={...db,rpc:async()=>({data:[],error:null}),
  from:()=>{throw Error("Unauthorized data read")}}
 const denied=await nativeFinanceExportResponse(noAccess,signed("staff"))
 assert.equal(denied.status,403)
})
test("direct native auth needs explicit flag and QA origin, never a Main binding",async()=>{
 const fields=new FormData()
 fields.set("portal","staff");fields.set("email","");fields.set("password","")
 const makeRequest=()=>new Request(origin+"/api/auth/portal-login",{
  method:"POST",headers:{Origin:origin,"Sec-Fetch-Site":"same-origin"},body:fields
 })
 const direct={...candidate,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"true"}
 const response=await app.request(makeRequest(),{},direct)
 assert.equal(response.status,200)
 assert.equal(response.headers.get("x-uptilldawn-auth-runtime"),"native-original-source")
 assert.deepEqual(await response.json(),{error:"E-mail en wachtwoord zijn verplicht."})
 const without=await app.request(makeRequest(),{},candidate)
 assert.equal(without.status,503)
 const wrong=await app.request(makeRequest(),{},{
  ...direct,SUPABASE_URL:"https://production.invalid"
 })
 assert.equal(wrong.status,503)
 const callback=await app.request(origin+"/auth/callback?error=denied",{},direct)
 assert.equal(callback.status,307)
 assert.match(callback.headers.get("location"),/^https:\/\/uptilldawn-modern-main\.uptilldawn\.workers\.dev\/verify-email/)
})
test("unknown forged action is rejected locally even when QA writes are explicitly enabled",async()=>{
 let upstream=0
 const env={...candidate,UPT_MIGRATION_ALLOW_WRITES:"true",
  MAIN_AUTH:{fetch:async()=>{upstream++;throw Error("FORBIDDEN_BRIDGE")}}}
 const fd=new FormData()
 fd.set("_id","lib/actions/uptilldawn.ts#nonexistent")
 fd.set("_args","[]")
 const response=await app.request(new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:origin,"X-UpTillDawn-Action-Hint":"lib/actions/uptilldawn.ts#nonexistent"},body:fd
 }),{},env)
 assert.equal(response.status,404)
 assert.deepEqual(await response.json(),{error:"unknown_action"})
 assert.equal(upstream,0)
})
test("public QA remains write-disabled and unauthenticated native routes never reach legacy",async()=>{
 const res=await app.request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:origin},body:new FormData()
 },candidate)
 assert.equal(res.status,503)
 assert.deepEqual(await res.json(),{error:"migration_writes_disabled"})
 const result=await app.request(origin+"/api/administration/finance/export",{},candidate)
 assert.equal(result.status,401)
})
