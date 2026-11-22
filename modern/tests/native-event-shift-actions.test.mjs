import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {
 nativeWaveThreeActionIds,nativeEventAdminActionIds,nativeShiftMemberActionIds,
 nativeWaveThreeAllowed,originalWaveThreeCommand,nativeWaveThreeActionResponse
} from "../src/api/native-event-shift-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const event="aaaabbbb-cccc-4ddd-8eee-000000000002"
const shift="aaaabbbb-cccc-4ddd-8eee-000000000003"
const request="aaaabbbb-cccc-4ddd-8eee-000000000004"
const other="aaaabbbb-cccc-4ddd-8eee-000000000005"
const id=name=>"lib/actions/"+name
const cases=[
 ["events.ts#closeEvent",{event_id:event,force:"on",reason:" Operational close "},"upt_close_event",{p_event:event,p_force:true,p_reason:"Operational close"},true],
 ["events.ts#archiveEvent",{event_id:event},"upt_archive_event",{p_event:event},true],
 ["events.ts#restoreEvent",{event_id:event,reason:" QA restore "},"upt_restore_event",{p_event:event,p_reason:"QA restore"},true],
 ["uptilldawn.ts#decideShiftChange",{request_id:request,decision:"rejected",reason:" Already covered "},"upt_decide_shift_change",{p_request:request,p_decision:"rejected",p_reason:"Already covered"},true],
 ["uptilldawn.ts#cancelShift",{shift_id:shift,reason:" Work cancelled "},"upt_cancel_shift",{p_shift:shift,p_reason:"Work cancelled"},true],
 ["uptilldawn.ts#reassignShift",{shift_id:shift,user_id:other,reason:" Shift coverage "},"upt_reassign_shift",{p_shift:shift,p_user:other,p_reason:"Shift coverage"},true],
 ["uptilldawn.ts#confirmShift",{shift_id:shift},"upt_confirm_shift",{p_shift:shift},false],
 ["uptilldawn.ts#requestShiftReplacement",{shift_id:shift,replacement_user_id:other,reason:" Replacement needed "},"upt_request_shift_change",{p_type:"replacement",p_shift:shift,p_replacement:other,p_reason:"Replacement needed"},false],
 ["uptilldawn.ts#requestShiftSwap",{shift_id:shift,replacement_user_id:other,target_shift_id:event,reason:" Swap shift times "},"upt_request_shift_change",{p_type:"swap",p_shift:shift,p_replacement:other,p_target_shift:event,p_reason:"Swap shift times"},false],
 ["uptilldawn.ts#claimOpenShift",{shift_id:shift,reason:" Can cover this "},"upt_request_shift_change",{p_type:"claim-open-shift",p_shift:shift,p_reason:"Can cover this"},false],
 ["uptilldawn.ts#respondShiftChange",{request_id:request,response:"accepted"},"upt_respond_shift_change",{p_request:request,p_response:"accepted"},false],
 ["uptilldawn.ts#cancelShiftChange",{request_id:request},"upt_cancel_shift_change",{p_request:request},false],
]
function form(values={}){
 const fd=new FormData()
 for(const [name,value] of Object.entries(values))fd.set(name,value)
 return fd
}
function post(key,fields={},opt={}){
 const fd=new FormData()
 fd.set("_id",opt.actualId??key)
 fd.set("_args",opt.raw??JSON.stringify(encode(opt.args??[form(fields)],fd)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{
   Origin:opt.origin??origin,"Sec-Fetch-Site":opt.site??"same-origin",
   "X-UpTillDawn-Action-Hint":key
  },body:fd
 })
}
function fixture({hasUser=true,approved=true,blocked=false,admin=true,error=null}={}){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:hasUser?{id:user}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   if(name==="upt_current_profile")return {data:[{approved,account_blocked:blocked}],error:null}
   return {data:null,error}
  }
 }
 return {db,calls}
}
test("third wave exactly matches 12 original Main action source IDs, with no overlap",()=>{
 assert.equal(nativeWaveThreeActionIds.length,12)
 assert.equal(nativeEventAdminActionIds.length,6)
 assert.equal(nativeShiftMemberActionIds.length,6)
 const source=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 assert.deepEqual([...nativeWaveThreeActionIds].sort(),cases.map(x=>id(x[0])).sort())
 for(const [name,fields,rpc,args]of cases){
  assert.ok(source.includes('"'+id(name)+'"'))
  assert.equal(nativeWaveThreeAllowed(id(name)),true)
  assert.deepEqual(originalWaveThreeCommand(id(name),form(fields)),{rpc,args})
  const file=name.slice(0,name.indexOf("#"))
  const original=readFileSync(new URL("../../lib/actions/"+file,import.meta.url),"utf8")
  assert.ok(original.includes("rpc('"+rpc+"'"),"Original RPC drift "+name)
 }
 for(const otherId of ["","../secret","lib/actions/auth.ts#signIn",
   "lib/actions/events.ts#archiveEventWithState","__proto__",
   "lib/actions/platform.ts#restorePlatformConfiguration"])
  assert.equal(nativeWaveThreeAllowed(otherId),false)
})
test("force archive chooses the original dedicated audited procedure; optional fields preserve omission",()=>{
 assert.deepEqual(originalWaveThreeCommand(id("events.ts#archiveEvent"),form({
  event_id:event,force:"on",reason:" Operational override "
 })),{rpc:"upt_force_archive_event",args:{p_event:event,p_reason:"Operational override"}})
 assert.deepEqual(originalWaveThreeCommand(id("events.ts#closeEvent"),form({event_id:event})),{
  rpc:"upt_close_event",args:{p_event:event,p_force:false,p_reason:undefined}
 })
 assert.deepEqual(originalWaveThreeCommand(id("uptilldawn.ts#decideShiftChange"),form({
  request_id:request,decision:"approved"
 })),{rpc:"upt_decide_shift_change",args:{p_request:request,p_decision:"approved"}})
 assert.deepEqual(originalWaveThreeCommand(id("uptilldawn.ts#cancelShift"),form({shift_id:shift})),{
  rpc:"upt_cancel_shift",args:{p_shift:shift}
 })
})
test("6 admin paths and 6 shift self-service paths validate different ORIGINAL signed authorization",async()=>{
 for(const [name,fields,rpc,args,isAdmin]of cases){
  const key=id(name),f=fixture()
  const response=await nativeWaveThreeActionResponse(post(key,fields),f.db,key)
  assert.equal(response.status,200,name)
  assert.equal(response.headers.get("cache-control"),"private, no-store")
  assert.deepEqual(await response.json(),{value:["undefined"],refresh:true},name)
  assert.deepEqual(f.calls,isAdmin?[
   ["upt_is_approved",undefined],["upt_is_admin",{uid:user}],[rpc,args]
  ]:[
   ["upt_current_profile",undefined],[rpc,args]
  ],name)
  for(const options of [
   {hasUser:false},{approved:false},...(isAdmin?[{admin:false}]:[{blocked:true}])
  ]){
   const denied=fixture(options)
   const rejected=await nativeWaveThreeActionResponse(post(key,fields),denied.db,key)
   assert.equal(rejected.status,options.hasUser===false?401:422,name)
   assert.equal(denied.calls.some(x=>x[0]===rpc),false,"Business RPC must not execute "+name)
  }
 }
})
test("malformed, unapproved, forged-origin and spoofed signed action IDs fail closed",async()=>{
 const key=id(cases[0][0]),fields=cases[0][1]
 for(const [req,status]of [
  [post(key,fields,{origin:"https://attacker.invalid"}),403],
  [post(key,fields,{site:"cross-site"}),403],
  [post(key,fields,{actualId:id(cases[1][0])}),404],
  [post(key,fields,{args:[]}),400],
  [post(key,fields,{raw:"{""}),400]
 ]){
  const f=fixture()
  const response=await nativeWaveThreeActionResponse(req,f.db,key)
  assert.equal(response.status,status)
  assert.deepEqual(f.calls,[])
 }
 const invalid=[
  [cases[0],{event_id:"../../../private"}],
  [cases[3],{request_id:request,decision:"rejected",reason:"No"}],
  [cases[5],{shift_id:shift,user_id:other,reason:"x"}],
  [cases[7],{shift_id:shift,replacement_user_id:"bad",reason:"replacement"}],
  [cases[8],{shift_id:shift,replacement_user_id:other,target_shift_id:"invalid",reason:"swap"}],
  [cases[10],{request_id:request,response:"override"}]
 ]
 for(const [[name],fields]of invalid){
  const key=id(name),f=fixture()
  const rejected=await nativeWaveThreeActionResponse(post(key,fields),f.db,key)
  assert.equal(rejected.status,422,name)
  assert.ok(f.calls.every(x=>["upt_is_admin","upt_is_approved","upt_current_profile"].includes(x[0])),name)
 }
})
test("all database errors are redacted; no success response or system secrets leak",async()=>{
 for(const [name,fields] of cases){
  const key=id(name),f=fixture({error:{message:"PRIVATE TOKEN: forbidden"}})
  const response=await nativeWaveThreeActionResponse(post(key,fields),f.db,key)
  assert.equal(response.status,422,name)
  assert.deepEqual(await response.json(),{
   error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
  })
 }
})
test("public QA Worker rejects all 12 original actions BEFORE any source forward or write",async()=>{
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",MAIN_AUTH:{fetch:async()=>{throw Error("UNEXPECTED LEGACY MAIN FORWARD")}}}
 for(const [name,fields]of cases){
  const response=await app.request(post(id(name),fields),{},env)
  assert.equal(response.status,503,name)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
})
