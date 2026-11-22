import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {nativeAdminActionAllowed,nativeAdminActionIds,originalAdminCommand,nativeAdminActionResponse} from "../src/api/native-admin-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const event="aaaabbbb-cccc-4ddd-8eee-000000000002"
const entry="aaaabbbb-cccc-4ddd-8eee-000000000003"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000004"
const task="aaaabbbb-cccc-4ddd-8eee-000000000005"
const item="aaaabbbb-cccc-4ddd-8eee-000000000006"
const sale="aaaabbbb-cccc-4ddd-8eee-000000000007"
const sourceIds=nativeAdminActionIds
const prefix=id=>"lib/actions/"+id
const cases=[
 [prefix("guestlist.ts#addGuestlistEntry"),{event_id:event,name:" Guest name ",entry_type:"artist",spots:"2",notes:" Thanks "},"upt_guestlist_add_entry",{p_event:event,p_name:"Guest name",p_entry_type:"artist",p_spots:2,p_notes:"Thanks"}],
 [prefix("guestlist.ts#updateGuestlistEntry"),{entry_id:entry,name:" Alice ",entry_type:"guest",spots:"9",notes:""},"upt_guestlist_update_entry",{p_entry:entry,p_name:"Alice",p_entry_type:"guest",p_spots:9,p_notes:undefined}],
 [prefix("guestlist.ts#removeGuestlistEntry"),{entry_id:entry},"upt_guestlist_remove_entry",{p_entry:entry}],
 [prefix("guestlist.ts#setBackstageWorkplace"),{event_id:event,workplace_id:workplace},"upt_guestlist_set_backstage_workplace",{p_event:event,p_workplace:workplace}],
 [prefix("guestlist.ts#setArtistHospitality"),{entry_id:entry,drinks:" Water ",hospitality_notes:" Vegan "},"upt_guestlist_set_artist_hospitality",{p_entry:entry,p_drinks:"Water",p_notes:"Vegan"}],
 [prefix("sales.ts#configureSaleItem"),{item_id:item,enabled:"on",sale_category:"merch",price:"13,45"},"upt_sales_configure_item",{p_item:item,p_enabled:true,p_category:"merch",p_price_cents:1345}],
 [prefix("sales.ts#setOpeningCash"),{event_id:event,workplace_id:workplace,opening_cash:"150.23"},"upt_sales_set_opening_cash",{p_event:event,p_workplace:workplace,p_opening_cash_cents:15023}],
 [prefix("sales.ts#refundSale"),{sale_id:sale,quantity:"4",notes:"Test reversal"},"upt_sales_refund",{p_sale:sale,p_quantity:4,p_notes:"Test reversal"}],
 [prefix("platform.ts#generatePlanningRecommendations"),{event_id:event},"upt_generate_planning_recommendations",{p_event:event}],
 [prefix("platform.ts#applyPlanningRecommendation"),{recommendation_id:task},"upt_apply_planning_recommendation",{p_recommendation:task}],
 [prefix("platform.ts#dismissPlanningRecommendation"),{recommendation_id:task},"upt_dismiss_planning_recommendation",{p_recommendation:task}],
 [prefix("platform.ts#generateEventReport"),{event_id:event},"upt_generate_event_report",{p_event:event}]
]
function form(values={}){const f=new FormData();for(const [key,value]of Object.entries(values))f.append(key,value);return f}
function request(id,fields={},other={}){
 const attachments=new FormData()
 const args=other.args??[form(fields)]
 attachments.set("_id",other.actualId??id)
 attachments.set("_args",other.payload??JSON.stringify(encode(args,attachments)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",
  headers:{Origin:other.origin??origin,...(other.headers??{})},
  body:attachments
 })
}
function stub({approved=true,admin=true,authorized=true,rpcError=null}={}){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:authorized?{id:user}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   return {data:null,error:rpcError}
  }
 }
 return {db,calls}
}
test("exact 12 original action IDs, no caller-selected modules or accidental duplicate handlers",()=>{
 assert.equal(sourceIds.length,12)
 assert.deepEqual([...new Set(sourceIds)].sort(),[...sourceIds].sort())
 assert.deepEqual([...sourceIds].sort(),cases.map(x=>x[0]).sort())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const id of sourceIds){
  assert.equal(nativeAdminActionAllowed(id),true)
  assert.ok(registry.includes('"'+id+'"'),"Only actions already reviewed by original source may be native")
 }
 for(const id of ["lib/actions/auth.ts#signOut","lib/actions/uptilldawn.ts#createEvent","__proto__","../../",""]){
  assert.equal(nativeAdminActionAllowed(id),false)
 }
 const originalGuest=readFileSync(new URL("../../lib/actions/guestlist.ts",import.meta.url),"utf8")
 const originalSales=readFileSync(new URL("../../lib/actions/sales.ts",import.meta.url),"utf8")
 const originalPlatform=readFileSync(new URL("../../lib/actions/platform.ts",import.meta.url),"utf8")
 for(const [id,fields,rpc,expected]of cases){
  const original=id.includes("guestlist.ts")?originalGuest:id.includes("sales.ts")?originalSales:originalPlatform
  assert.ok(original.includes('rpc(\''+rpc+'\''),"Source RPC changed for "+id)
  assert.deepEqual(originalAdminCommand(id,form(fields)),{rpc,args:expected})
 }
})
test("all 12 native administrator commands authenticate, check original admin RPC and preserve exact wire response",async()=>{
 for(const [id,fields,rpc,expected]of cases){
  const f=stub()
  const response=await nativeAdminActionResponse(request(id,fields),f.db,id)
  assert.equal(response.status,200,id)
  assert.deepEqual(await response.json(),{value:["undefined"],refresh:true},id)
  assert.equal(response.headers.get("cache-control"),"private, no-store")
  assert.deepEqual(f.calls,[
   ["upt_is_approved",undefined],
   ["upt_is_admin",{uid:user}],
   [rpc,expected]
  ],id)
 }
})
test("revoked admin, unapproved user and expired authentication never reach a mutating RPC",async()=>{
 const id=cases[0][0]
 for(const params of [{approved:false},{admin:false},{authorized:false}]){
  const f=stub(params)
  const resp=await nativeAdminActionResponse(request(id,cases[0][1]),f.db,id)
  assert.equal(resp.status,params.authorized===false?401:422)
  assert.ok(f.calls.every(([name])=>name==="upt_is_approved"||name==="upt_is_admin"))
 }
 const down=stub({rpcError:{message:"private database error"}})
 const err=await nativeAdminActionResponse(request(id,cases[0][1]),down.db,id)
 assert.equal(err.status,422)
 assert.deepEqual(await err.json(),{error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"})
 assert.ok(!JSON.stringify(await err.headers).includes("private database error"))
})
test("untrusted hint cannot alter the actual source _id or circumvent form + origin bounds",async()=>{
 const id=cases[0][0]
 const examples=[
  [request(id,cases[0][1],{actualId:cases[1][0]}),404],
  [request(id,cases[0][1],{origin:"https://attacker.invalid"}),403],
  [request(id,cases[0][1],{headers:{"Sec-Fetch-Site":"cross-site"}}),403],
  [request(id,cases[0][1],{args:[]}),400],
  [request(id,cases[0][1],{payload:"{not valid json"}),400],
  [request(id,cases[0][1],{args:["not-a-form"]}),400]
 ]
 for(const [request,status]of examples){
  const f=stub()
  const response=await nativeAdminActionResponse(request,f.db,id)
  assert.equal(response.status,status)
  assert.deepEqual(f.calls,[])
 }
})
test("invalid amount, UUID, category, count or notes cannot issue any mutation",async()=>{
 for(const [id,values]of [
  [prefix("sales.ts#configureSaleItem"),{item_id:item,enabled:"on",sale_category:"token",price:"1000000.11"}],
  [prefix("sales.ts#configureSaleItem"),{item_id:item,enabled:"on",sale_category:"fraud",price:"5.00"}],
  [prefix("sales.ts#setOpeningCash"),{event_id:event,workplace_id:workplace,opening_cash:"-2"}],
  [prefix("sales.ts#refundSale"),{sale_id:sale,quantity:"0"}],
  [prefix("sales.ts#refundSale"),{sale_id:sale,quantity:"20000"}],
  [prefix("guestlist.ts#addGuestlistEntry"),{event_id:event,name:"a",entry_type:"guest",spots:"101"}],
  [prefix("guestlist.ts#removeGuestlistEntry"),{entry_id:"a"}],
  [prefix("platform.ts#generateEventReport"),{event_id:"../../bad"}]
 ]){
  const f=stub()
  const response=await nativeAdminActionResponse(request(id,values),f.db,id)
  assert.equal(response.status,422,id)
  assert.equal(f.calls.filter(([n])=>n.startsWith("upt_")&&!["upt_is_admin","upt_is_approved"].includes(n)).length,0,id)
 }
})
test("QA Worker rejects all 12 native actions before auth, parsing or Main upstream when write gate is false",async()=>{
 let forwarded=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{forwarded++;return Response.json({ok:true})}}}
 for(const [id,fields]of cases){
  const req=request(id,fields)
  req.headers.set("X-UpTillDawn-Action-Hint",id)
  const response=await app.request(req,{},env)
  assert.equal(response.status,503,id)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(forwarded,0)
})
test("unknown/missing action hint stays streamed through original allowlisted service only when write gate explicitly true",async()=>{
 const id=cases[0][0]
 let forwarded=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"true",
  MAIN_AUTH:{fetch:async req=>{forwarded++;assert.equal(req.headers.get("x-uptilldawn-action-hint"),null);return Response.json({value:["undefined"],refresh:true})}}}
 const req=request(id,cases[0][1])
 const result=await app.request(req,{},env)
 assert.equal(result.status,200)
 assert.equal(forwarded,1)
})
