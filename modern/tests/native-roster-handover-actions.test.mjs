import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {
 nativeRosterActionIds,nativeRosterAdminActionIds,nativeRosterResponsibleActionIds,
 nativeRosterMemberActionIds,nativeRosterActionAllowed,originalRosterCommand,
 nativeRosterActionResponse
} from "../src/api/native-roster-handover-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000002"
const event="aaaabbbb-cccc-4ddd-8eee-000000000003"
const shift="aaaabbbb-cccc-4ddd-8eee-000000000004"
const handover="aaaabbbb-cccc-4ddd-8eee-000000000005"
const start="2026-11-25T16:00:00+01:00",end="2026-11-25T20:00:00+01:00"
const id=name=>"lib/actions/uptilldawn.ts#"+name
const cases=[
 ["createShift",{workplace_id:workplace,user_id:user,role_name:" Driver ",start,end,shift_kind:"setup",overlap_allowed:"on"},"upt_create_shift",{p_workplace:workplace,p_user:user,p_role_name:"Driver",p_start:start,p_end:end,p_overlap_allowed:true,p_shift_kind:"setup"},"admin"],
 ["updateShift",{shift_id:shift,role_name:" Coordinator ",start,end,shift_kind:"event"},"upt_update_shift",{p_shift:shift,p_role_name:"Coordinator",p_start:start,p_end:end,p_overlap_allowed:false,p_shift_kind:"event"},"admin"],
 ["updateEventEmergencyInformation",{event_id:event,emergency_number:" 112 ",first_aid_contact:" Crew ",security_contact:" Security ",assembly_point:" Entrance ",procedure:" Evacuate "},"upt_upsert_event_emergency_information",{p_event:event,p_emergency_number:"112",p_first_aid_contact:"Crew",p_security_contact:"Security",p_assembly_point:"Entrance",p_procedure:"Evacuate"},"admin"],
 ["saveShiftHandover",{event_id:event,workplace_id:workplace,incoming_user_id:user,mark_ready:"true",equipment_notes:" Stock checked ",notes:" Everything fine "},"upt_save_shift_handover",{p_event:event,p_workplace:workplace,p_incoming:user,p_equipment_notes:"Stock checked",p_notes:"Everything fine",p_mark_ready:true},"responsible"],
 ["acceptShiftHandover",{handover_id:handover},"upt_accept_shift_handover",{p_handover:handover},"responsible"],
 ["setEventAvailability",{event_id:event,response:"can",setup_available:"yes",breakdown_available:"no",reason:" Available "},"upt_set_event_availability_with_reason",{p_event:event,p_response:"can",p_setup:true,p_breakdown:false,p_reason:"Available"},"member"],
 ["declineShift",{shift_id:shift,reason:" Transport unavailable "},"upt_respond_shift",{p_shift:shift,p_response:"declined",p_reason:"Transport unavailable"},"member"],
]
function fd(data){const out=new FormData();for(const [k,v]of Object.entries(data))out.set(k,v);return out}
function post(key,fields={},options={}){
 const body=new FormData()
 body.set("_id",options.actualId??key)
 body.set("_args",options.raw??JSON.stringify(encode(options.args??[fd(fields)],body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{
   Origin:options.origin??origin,"Sec-Fetch-Site":options.site??"same-origin",
   "X-UpTillDawn-Action-Hint":key
  },body
 })
}
function fixture({signed=true,approved=true,blocked=false,admin=true,role="responsible_lead",effectiveRole=role,error=null}={}){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:signed?{id:user}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   if(name==="upt_current_profile")return {data:[{approved,account_blocked:blocked,role}],error:null}
   if(name==="upt_current_effective_role")return {data:effectiveRole,error:null}
   return {data:null,error}
  }
 }
 return {db,calls}
}
test("seven action IDs map exactly to original source procedures and preserve fields",()=>{
 assert.equal(nativeRosterAdminActionIds.length,3)
 assert.equal(nativeRosterResponsibleActionIds.length,2)
 assert.equal(nativeRosterMemberActionIds.length,2)
 assert.equal(nativeRosterActionIds.length,7)
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 const original=readFileSync(new URL("../../lib/actions/uptilldawn.ts",import.meta.url),"utf8")
 assert.deepEqual([...nativeRosterActionIds].sort(),cases.map(x=>id(x[0])).sort())
 for(const [name,fields,rpc,args]of cases){
  const key=id(name)
  assert.ok(registry.includes('"'+key+'"'),name)
  assert.ok(original.includes("rpc('"+rpc+"'"),"Original RPC not present "+name)
  assert.equal(nativeRosterActionAllowed(key),true)
  assert.deepEqual(originalRosterCommand(key,fd(fields)),{rpc,args},name)
 }
 for(const unknown of ["","__proto__","lib/actions/auth.ts#signIn","lib/actions/uptilldawn.ts#closeEvent","lib/actions/uptilldawn.ts#createTask"])
  assert.equal(nativeRosterActionAllowed(unknown),false)
})
test("original default values, optional handover targets and emergency contact normalization",()=>{
 assert.deepEqual(originalRosterCommand(id("createShift"),fd({
  workplace_id:workplace,user_id:user,start,end
 })),{rpc:"upt_create_shift",args:{
  p_workplace:workplace,p_user:user,p_role_name:"Personeel",
  p_start:start,p_end:end,p_overlap_allowed:false,p_shift_kind:"event"
 }})
 assert.deepEqual(originalRosterCommand(id("saveShiftHandover"),fd({
  event_id:event,workplace_id:workplace
 })),{rpc:"upt_save_shift_handover",args:{
  p_event:event,p_workplace:workplace,p_incoming:undefined,
  p_equipment_notes:undefined,p_notes:undefined,p_mark_ready:false
 }})
})
test("three admin, two responsible and two approved-member paths enforce separate signed roles",async()=>{
 for(const [name,fields,rpc,args,kind]of cases){
  const key=id(name),f=fixture()
  const response=await nativeRosterActionResponse(post(key,fields),f.db,key)
  assert.equal(response.status,200,name)
  assert.equal(response.headers.get("cache-control"),"private, no-store")
  assert.deepEqual(await response.json(),{value:["undefined"],refresh:true},name)
  assert.deepEqual(f.calls,kind==="admin"?[
   ["upt_is_approved",undefined],["upt_is_admin",{uid:user}],[rpc,args]
  ]:kind==="responsible"?[
   ["upt_current_profile",undefined],["upt_current_effective_role",undefined],[rpc,args]
  ]:[
   ["upt_current_profile",undefined],[rpc,args]
  ],name)
  for(const v of [
   {signed:false},{approved:false},
   ...(kind==="admin"?[{admin:false}]:[{blocked:true}]),
   ...(kind==="responsible"?[{role:"staff",effectiveRole:"staff"}]:[])
  ]){
   const g=fixture(v),rejected=await nativeRosterActionResponse(post(key,fields),g.db,key)
   assert.equal(rejected.status,v.signed===false?401:422,name)
   assert.ok(!g.calls.some(x=>x[0]===rpc),"Denied person cannot invoke "+rpc)
  }
 }
})
test("malformed payloads, forged action identifiers, invalid shifts and incomplete handovers fail closed",async()=>{
 const [name,fields]=cases[0],key=id(name)
 for(const [req,status]of [
  [post(key,fields,{origin:"https://attacker.invalid"}),403],
  [post(key,fields,{site:"cross-site"}),403],
  [post(key,fields,{actualId:id("updateShift")}),404],
  [post(key,fields,{args:[]}),400],
  [post(key,fields,{raw:"{"}),400]
 ]){
  const f=fixture(),response=await nativeRosterActionResponse(req,f.db,key)
  assert.equal(response.status,status)
  assert.deepEqual(f.calls,[])
 }
 const invalid=[
  [cases[0],{...cases[0][1],end:start}],
  [cases[0],{...cases[0][1],shift_kind:"illegal"}],
  [cases[1],{...cases[1][1],shift_id:"bad"}],
  [cases[3],{event_id:event,workplace_id:workplace,mark_ready:"true"}],
  [cases[5],{...cases[5][1],setup_available:"maybe"}],
  [cases[6],{...cases[6][1],reason:"  "}]
 ]
 for(const [[name,_,rpc],fields]of invalid){
  const key=id(name),f=fixture()
  const response=await nativeRosterActionResponse(post(key,fields),f.db,key)
  assert.equal(response.status,422,name)
  assert.ok(f.calls.every(c=>c[0]!==rpc),"Invalid source args must not reach DB "+name)
 }
})
test("real RPC failures do not leak metadata or claim success",async()=>{
 for(const [name,fields]of cases){
  const key=id(name),f=fixture({error:{message:"PRIVATE_TOKEN_MUST_NOT_LEAK"}})
  const response=await nativeRosterActionResponse(post(key,fields),f.db,key)
  assert.equal(response.status,422)
  assert.deepEqual(await response.json(),{
   error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
  })
 }
})
test("public Main-QA Worker strictly blocks all seven actions before reaching DB/source",async()=>{
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("MUST_NOT_FORWARD_MAIN")}}}
 for(const [name,fields]of cases){
  const response=await app.request(post(id(name),fields),{},env)
  assert.equal(response.status,503,name)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
})
