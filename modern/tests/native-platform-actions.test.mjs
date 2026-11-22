import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {encode} from "../../lib/migration/wire.ts"
import {nativeWaveTwoAllowed,nativeWaveTwoActionIds,nativePlatformAdminActionIds,
 nativeMemberActionIds,originalWaveTwoCommand,nativeWaveTwoActionResponse} from "../src/api/native-platform-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const u="aaaabbbb-cccc-4ddd-8eee-000000000001"
const event="aaaabbbb-cccc-4ddd-8eee-000000000002"
const item="aaaabbbb-cccc-4ddd-8eee-000000000003"
const stamp="2026-11-24T17:30:00+01:00"
const cases=[
 ["platform.ts#setFeatureRollout",{feature_key:" checkin ",enabled:"on",audience:"responsible",rollout_percentage:"75",notes:" all "},"upt_set_feature_rollout",{p_feature_key:"checkin",p_enabled:true,p_audience:"responsible",p_rollout_percentage:75,p_notes:"all"}],
 ["platform.ts#snapshotPlatformConfiguration",{note:" QA snapshot "},"upt_snapshot_platform_configuration",{p_note:"QA snapshot"}],
 ["platform.ts#captureEventTemplate",{event_id:event,name:" Festival ",section:["workplaces","tasks"]},"upt_capture_event_template",{p_event:event,p_name:"Festival",p_sections:["workplaces","tasks"]}],
 ["platform.ts#applyEventTemplate",{template_id:item,name:" New event ",start_at:stamp,end_at:"2026-11-24T23:30:00+01:00",venue:" Hall ",address:" Main street "},"upt_apply_event_template",{p_template:item,p_name:"New event",p_start:stamp,p_end:"2026-11-24T23:30:00+01:00",p_venue:"Hall",p_address:"Main street"}],
 ["platform.ts#restorePlatformConfiguration",{version_id:item},"upt_restore_platform_configuration",{p_version:item}],
 ["platform.ts#saveAutomationRule",{automation_key:" arrival_alert ",enabled:"on",delay_minutes:"5",reminder_minutes:"60",escalation_minutes:"120",cooldown_minutes:"10",max_retries:"3",channel:["push","sms","email"]},"upt_save_automation_rule",{p_key:"arrival_alert",p_enabled:true,p_delay_minutes:5,p_reminder_minutes:60,p_escalation_minutes:120,p_cooldown_minutes:10,p_max_retries:3,p_channels:["push","email"]}],
 ["workplace-catalog.ts#syncCatalogToEvent",{event_id:event},"upt_sync_workplace_catalog_to_event",{p_event:event}],
 ["onboarding.ts#completeEventOnboardingStep",{event_id:event,step:"confirmed"},"upt_complete_event_onboarding_step",{p_event:event,p_step:"confirmed"}],
 ["uptilldawn.ts#markNotificationRead",{notification_id:item},"upt_mark_notification_read",{p_notification:item}],
 ["uptilldawn.ts#acknowledgeBriefing",{id:item},"upt_acknowledge_briefing",{p_briefing:item}],
 ["uptilldawn.ts#acknowledgeInstruction",{id:item},"upt_acknowledge_personal_instruction",{p_instruction:item}]
]
const action=x=>"lib/actions/"+x
function fd(values={}){const f=new FormData();for(const [k,v]of Object.entries(values)){if(Array.isArray(v)){for(const x of v)f.append(k,x)}else f.set(k,v)}return f}
function post(id,fields={},options={}){
 const files=new FormData()
 files.set("_id",options.actualId??id)
 files.set("_args",options.payload??JSON.stringify(encode(options.args??[fd(fields)],files)))
 return new Request(origin+"/api/migration/actions",{method:"POST",headers:{
  Origin:options.origin??origin,"Sec-Fetch-Site":options.site??"same-origin",
  "X-UpTillDawn-Action-Hint":id,...(options.headers??{})
 },body:files})
}
function fixture({admin=true,approved=true,user=true,data=null,error=null}={}){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:user?{id:u}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   return {data,error}
  }
 }
 return {db,calls}
}
test("11 second-wave exact original source IDs and RPC procedures are immutable",()=>{
 assert.equal(nativeWaveTwoActionIds.length,11)
 assert.equal(nativePlatformAdminActionIds.length,7)
 assert.equal(nativeMemberActionIds.length,4)
 assert.equal(new Set(nativeWaveTwoActionIds).size,11)
 assert.deepEqual([...nativeWaveTwoActionIds].sort(),cases.map(x=>action(x[0])).sort())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const [name,fields,rpc,args]of cases){
  const id=action(name),file=name.split("#")[0]
  assert.ok(registry.includes('"'+id+'"'),id)
  assert.ok(nativeWaveTwoAllowed(id))
  assert.deepEqual(originalWaveTwoCommand(id,fd(fields)),{rpc,args,...(name==="platform.ts#applyEventTemplate"?{redirectOnData:"/events"}:{})},id)
  const src=readFileSync(new URL("../../lib/actions/"+file,import.meta.url),"utf8")
  assert.ok(src.includes("rpc('"+rpc+"'"),"Original business SQL RPC drift: "+id)
 }
 for(const unknown of ["../../src","lib/actions/auth.ts#enterNormalAppFromMakerSession",
   "lib/actions/guestlist.ts#addGuestlistEntry","","__proto__"]){
  assert.equal(nativeWaveTwoAllowed(unknown),false)
 }
})
test("7 admin and 4 member actions verify original approved role and signed user",async()=>{
 for(const [name,fields,rpc,args]of cases){
  const id=action(name),f=fixture()
  const result=await nativeWaveTwoActionResponse(post(id,fields),f.db,id)
  assert.equal(result.status,200,id)
  assert.deepEqual(await result.json(),{value:["undefined"],refresh:true},id)
  assert.equal(result.headers.get("cache-control"),"private, no-store")
  assert.deepEqual(f.calls,[
   ["upt_is_approved",undefined],
   ...(nativePlatformAdminActionIds.includes(id)?[["upt_is_admin",{uid:u}]]:[]),
   [rpc,args]
  ],id)
  for(const parameters of [{user:false},{approved:false},...(nativePlatformAdminActionIds.includes(id)?[{admin:false}]:[])]){
   const denied=fixture(parameters)
   const response=await nativeWaveTwoActionResponse(post(id,fields),denied.db,id)
   assert.equal(response.status,parameters.user===false?401:422,id)
   assert.ok(denied.calls.every(([n])=>["upt_is_approved","upt_is_admin"].includes(n)),id)
  }
 }
})
test("exact original event-template redirect only when SQL returns a new event UUID",async()=>{
 const [name,fields]=cases[3],id=action(name)
 const f=fixture({data:event})
 const response=await nativeWaveTwoActionResponse(post(id,fields),f.db,id)
 assert.equal(response.status,200)
 assert.deepEqual(await response.json(),{redirect:"/events"})
 const none=await nativeWaveTwoActionResponse(post(id,fields),fixture({data:null}).db,id)
 assert.deepEqual(await none.json(),{value:["undefined"],refresh:true})
})
test("all action DB errors are redacted and no success/refresh is fabricated",async()=>{
 for(const [name,fields]of cases){
  const id=action(name)
  const db=fixture({error:{message:"private integration token leak"}})
  const response=await nativeWaveTwoActionResponse(post(id,fields),db.db,id)
  assert.equal(response.status,422,id)
  assert.deepEqual(await response.json(),{error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"})
 }
})
test("CSV, JSON and forged multipart requests cannot bypass original CSRF/session/ID/validation",async()=>{
 const [name,fields]=cases[0],id=action(name)
 for(const [req,status]of [
  [post(id,fields,{origin:"https://evil.invalid"}),403],
  [post(id,fields,{site:"cross-site"}),403],
  [post(id,fields,{actualId:action(cases[1][0])}),404],
  [post(id,fields,{args:[]}),400],
  [post(id,fields,{payload:`{"foo":`}),400],
 ]){
  const f=fixture()
  const out=await nativeWaveTwoActionResponse(req,f.db,id)
  assert.equal(out.status,status)
  assert.deepEqual(f.calls,[])
 }
 for(const [id,fields]of [
  [action(cases[0][0]),{...cases[0][1],audience:"god"}],
  [action(cases[0][0]),{...cases[0][1],rollout_percentage:"101"}],
  [action(cases[5][0]),{...cases[5][1],automation_key:"INVALID ROLE"}],
  [action(cases[5][0]),{...cases[5][1],max_retries:"100"}],
  [action(cases[3][0]),{...cases[3][1],start_at:"no date"}],
  [action(cases[7][0]),{...cases[7][1],step:"unapproved"}],
  [action(cases[6][0]),{event_id:"../../etc/passwd"}]
 ]){
  const f=fixture()
  const out=await nativeWaveTwoActionResponse(post(id,fields),f.db,id)
  assert.equal(out.status,422,id)
  assert.ok(!f.calls.some(([rpc])=>!["upt_is_approved","upt_is_admin"].includes(rpc)),id)
 }
})
test("deployed QA denies all 11 new original action IDs even with forged browser hints",async()=>{
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",MAIN_AUTH:{fetch:async()=>{throw Error("unexpected original backend call")}}}
 for(const [name,fields]of cases){
  const id=action(name),req=post(id,fields)
  const response=await app.request(req,{},env)
  assert.equal(response.status,503,id)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
})
