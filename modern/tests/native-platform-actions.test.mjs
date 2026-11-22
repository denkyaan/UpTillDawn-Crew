import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {
 nativeAdminActionAllowed,nativePlatformActionIds,
 originalAdminCommand,nativeAdminActionResponse
} from "../src/api/native-admin-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const event="aaaabbbb-cccc-4ddd-8eee-000000000002"
const version="aaaabbbb-cccc-4ddd-8eee-000000000004"
const actor="aaaabbbb-cccc-4ddd-8eee-000000000001"
const prefix="lib/actions/platform.ts#"
const cases=[
 ["setFeatureRollout",{feature_key:" new_feature ",enabled:"on",audience:"responsible",rollout_percentage:"35",notes:" Safe "},"upt_set_feature_rollout",
  {p_feature_key:"new_feature",p_enabled:true,p_audience:"responsible",p_rollout_percentage:35,p_notes:"Safe"}],
 ["snapshotPlatformConfiguration",{note:" Baseline "},"upt_snapshot_platform_configuration",{p_note:"Baseline"}],
 ["captureEventTemplate",{event_id:event,name:" Weekend ",section:["workplaces","briefing","tasks"]},"upt_capture_event_template",
  {p_event:event,p_name:"Weekend",p_sections:["workplaces","briefing","tasks"]}],
 ["restorePlatformConfiguration",{version_id:version},"upt_restore_platform_configuration",{p_version:version}],
 ["saveAutomationRule",{automation_key:"event_reminder",enabled:"on",delay_minutes:"30",reminder_minutes:"5",escalation_minutes:"10",cooldown_minutes:"60",max_retries:"2",channel:["email","push","invalid"]},"upt_save_automation_rule",
  {p_key:"event_reminder",p_enabled:true,p_delay_minutes:30,p_reminder_minutes:5,p_escalation_minutes:10,
   p_cooldown_minutes:60,p_max_retries:2,p_channels:["email","push"]}]
]
function form(fields){
 const fd=new FormData()
 for(const [name,val] of Object.entries(fields||{}))
  for(const item of Array.isArray(val)?val:[val])fd.append(name,item)
 return fd
}
function request(id,fields,actualId=id,originHeader=origin){
 const multipart=new FormData()
 multipart.set("_id",actualId)
 multipart.set("_args",JSON.stringify(encode([form(fields)],multipart)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:originHeader,"X-UpTillDawn-Action-Hint":id},
  body:multipart
 })
}
function db({approved=true,admin=true,authenticated=true,error=null}={}){
 const calls=[]
 return {calls,client:{
  auth:{getUser:async()=>({data:{user:authenticated?{id:actor}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   return {data:null,error}
  }
 }}
}
test("five exact existing original platform action IDs; wave one remains unchanged",()=>{
 assert.equal(nativePlatformActionIds.length,5)
 assert.deepEqual([...new Set(nativePlatformActionIds)].sort(),[...nativePlatformActionIds].sort())
 assert.deepEqual([...nativePlatformActionIds].sort(),cases.map(([name])=>prefix+name).sort())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 const source=readFileSync(new URL("../../lib/actions/platform.ts",import.meta.url),"utf8")
 for(const [name,,rpc] of cases){
  assert.equal(nativeAdminActionAllowed(prefix+name),true)
  assert.ok(registry.includes('"'+prefix+name+'"'))
  assert.ok(source.includes('rpc(\''+rpc+'\''),"Original platform RPC changed: "+name)
 }
})
test("five native platform commands match original FormData, authorization and response wire",async()=>{
 for(const [name,fields,rpc,expected] of cases){
  const id=prefix+name
  assert.deepEqual(originalAdminCommand(id,form(fields)),{rpc,args:expected},name)
  const mock=db()
  const response=await nativeAdminActionResponse(request(id,fields),mock.client,id)
  assert.equal(response.status,200,name)
  assert.deepEqual(await response.json(),{value:["undefined"],refresh:true},name)
  assert.deepEqual(mock.calls,[
   ["upt_is_approved",undefined],["upt_is_admin",{uid:actor}],[rpc,expected]
  ],name)
 }
})
test("defaults and filters preserve original automation rule behavior",()=>{
 const obj=originalAdminCommand(prefix+"saveAutomationRule",form({
  automation_key:"simple_rule",channel:["invalid","push"]
 }))
 assert.deepEqual(obj.args,{
  p_key:"simple_rule",p_enabled:false,p_delay_minutes:0,p_reminder_minutes:0,
  p_escalation_minutes:0,p_cooldown_minutes:0,p_max_retries:0,p_channels:["push"]
 })
 const defaults=originalAdminCommand(prefix+"captureEventTemplate",form({event_id:event,name:"Demo"}))
 assert.deepEqual(defaults.args.p_sections,[])
})
test("all five fail closed on invalid data, cross-origin requests, forged _id and denied identities",async()=>{
 const invalid=[
  ["setFeatureRollout",{feature_key:"x",audience:"unknown",rollout_percentage:"15"}],
  ["setFeatureRollout",{feature_key:"x",audience:"all",rollout_percentage:"101"}],
  ["captureEventTemplate",{event_id:"wrong",name:"Demo"}],
  ["captureEventTemplate",{event_id:event,name:"hi"}],
  ["restorePlatformConfiguration",{version_id:"../bad"}],
  ["saveAutomationRule",{automation_key:"not valid"}],
  ["saveAutomationRule",{automation_key:"valid",max_retries:"21"}],
  ["saveAutomationRule",{automation_key:"valid",reminder_minutes:"-1"}]
 ]
 for(const [name,fields] of invalid){
  const mock=db()
  const response=await nativeAdminActionResponse(request(prefix+name,fields),mock.client,prefix+name)
  assert.equal(response.status,422,name)
  assert.equal(mock.calls.filter(([n])=>n!=="upt_is_approved"&&n!=="upt_is_admin").length,0,name)
 }
 for(const options of [{approved:false},{admin:false},{authenticated:false}]){
  const mock=db(options)
  const id=prefix+cases[0][0]
  const response=await nativeAdminActionResponse(request(id,cases[0][1]),mock.client,id)
  assert.equal(response.status,options.authenticated===false?401:422)
  assert.equal(mock.calls.filter(([n])=>n==="upt_set_feature_rollout").length,0)
 }
 const mock=db()
 const wrongId=await nativeAdminActionResponse(
  request(prefix+cases[0][0],cases[0][1],prefix+cases[1][0]),mock.client,prefix+cases[0][0])
 assert.equal(wrongId.status,404)
 const crossOrigin=await nativeAdminActionResponse(
  request(prefix+cases[0][0],cases[0][1],prefix+cases[0][0],"https://evil.invalid"),mock.client,prefix+cases[0][0])
 assert.equal(crossOrigin.status,403)
 assert.deepEqual(mock.calls,[])
})
test("deployed candidate config denies ALL five new writes before any Supabase RPC or Main forwarding",async()=>{
 let forwarded=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{forwarded++;throw Error("Forbidden legacy forward")}}}
 for(const [name,fields] of cases){
  const id=prefix+name
  const res=await app.request(request(id,fields),{},env)
  assert.equal(res.status,503,name)
  assert.deepEqual(await res.json(),{error:"migration_writes_disabled"},name)
 }
 assert.equal(forwarded,0)
})
