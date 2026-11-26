import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {megaPeopleActionIds,megaPeopleAllowed,megaPeopleResponse} from "../src/api/native-mega-people-actions.ts"
import {megaOperationsActionIds,megaOperationsAllowed,megaOperationsResponse} from "../src/api/native-mega-operations-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const target="aaaabbbb-cccc-4ddd-8eee-000000000002"
const event="aaaabbbb-cccc-4ddd-8eee-000000000003"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000004"
const task="aaaabbbb-cccc-4ddd-8eee-000000000005"
const receiptRequest="aaaabbbb-cccc-4ddd-8eee-000000000006"
const time="2026-12-01T16:00:00+01:00"
const people=[
 ["promotion-tasks.ts#createPromotionTask",{
  request:receiptRequest,title:"Social",description:"Share promotion",user_id:target,admin_view:"1"
 },"upt_admin_create_promotion_task"],
 ["promotion-tasks.ts#assignGeneralPromotionTask",{task_id:task,user_id:target},"upt_admin_assign_promotion_task"],
 ["promotion-tasks.ts#editPromotionTask",{task_id:task,title:"Social",description:"Promote",expected_updated_at:time},"upt_admin_update_promotion_task"],
 ["promotion-tasks.ts#removeGeneralPromotionAssignment",{assignment_id:task},"upt_remove_task_assignment"],
 ["admin-inventory-batch.ts#receiveAdminInventoryBatch",{
  request:receiptRequest,document:event,confirm:"yes",rows:JSON.stringify([{line:workplace,item:task,quantity:2}])
 },"upt_admin_receive_inventory_batch"],
 ["portal-roles.ts#changePortalRole",{user_id:target,portal:"events",role:"event_staff",action:"approve"},"upt_admin_set_portal_role"],
 ["personnel-dual-roles.ts#savePersonnelRoleSlot",{user_id:target,role_one:"staff",role_two:"promotion",save_slot:"1"},"upt_admin_set_two_personnel_roles"],
 ["personnel.ts#setPersonnelBlock",{user_id:target,blocked:"true",reason:"QA"},"upt_admin_set_personnel_block"],
 ["personnel.ts#setPersonnelRole",{user_id:target,role:"staff"},"upt_admin_set_account"],
 ["uptilldawn.ts#approvePersonnelAccount",{user_id:target,role:"staff"},"upt_admin_set_account"],
 ["uptilldawn.ts#setAccountStatus",{user_id:target,status:"approved",role:"staff"},"upt_admin_set_account"]
]
const operations=[
 ["platform.ts#savePayRate",{user_id:target,hourly_rate:"21.50",employer_multiplier:"1.5",effective_from:"2026-12-01"},"staff_pay_rates"],
 ["platform.ts#createKnowledgeArticle",{title:"Safety",body:"Emergency exit",offline_critical:"on"},"knowledge_articles"],
 ["platform.ts#createQrResource",{resource_type:"workplace",title:"Crew QR",route:"/workplaces"},"qr_resources"],
 ["platform.ts#updateAssetMetadata",{item_id:task,asset_code:"TEST",reorder_threshold:"2",unit_cost:"3.5"},"upt_update_inventory_asset_form"],
 ["uptilldawn.ts#removeOperationalChecklistItem",{item_id:task},"upt_remove_operational_checklist_item"],
 ["uptilldawn.ts#reopenOperationalChecklistItem",{item_id:task},"upt_set_operational_checklist_item"],
 ["uptilldawn.ts#archiveEventDocument",{document_id:task},"upt_archive_event_document"],
 ["uptilldawn.ts#removeTaskAssignment",{assignment_id:task},"upt_remove_task_assignment"],
 ["uptilldawn.ts#markAllNotificationsRead",{},"crew_notifications"],
 ["uptilldawn.ts#updateEvent",{
  event_id:event,name:"QA event",start_at:time,end_at:"2026-12-02T08:00:00+01:00",
  registration_deadline:time,radius:"100",max_joiners:"12"
 },"events"]
]
const all=[...people,...operations]
const id=name=>"lib/actions/"+name
const stateful=new Set(["receiveAdminInventoryBatch","savePersonnelRoleSlot"])
function request(name,fields={},opts={}){
 const action=id(name),fd=new FormData()
 for(const [key,v]of Object.entries(fields))
  if(Array.isArray(v))for(const item of v)fd.append(key,String(item))
  else fd.set(key,String(v))
 const args=name.endsWith("#markAllNotificationsRead")?[]:
  stateful.has(name.split("#")[1])?[{error:null},fd]:[fd]
 const body=new FormData()
 body.set("_id",opts.actualId??action)
 body.set("_args",opts.raw??JSON.stringify(encode(opts.args??args,body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:opts.origin??origin,
   "Sec-Fetch-Site":opts.site??"same-origin","X-UpTillDawn-Action-Hint":action},body
 })
}
function fixture({role="admin",approved=true,blocked=false,owner=false,auth=true,error=null}={}){
 const calls=[]
 const actor={id:user,role,approved,account_blocked:blocked,is_owner:owner,effective_role:role}
 function query(table){
  const q={
   select:()=>q,eq:()=>q,neq:()=>q,is:()=>q,lte:()=>q,
   in:()=>q,order:()=>q,limit:()=>q,
   insert:(data)=>{calls.push(["insert",table,data]);return q},
   update:(data)=>{calls.push(["update",table,data]);return q},
   delete:()=>{calls.push(["delete",table]);return q},
   single:async()=>({data:table==="task_assignments"?
    {tasks:{event_id:event,workplace_id:workplace}}:null,error}),
   maybeSingle:async()=>({data:table==="task_assignments"?
    {tasks:{promotion_only:true,event_id:null}}:
    table==="checklist_items"?{photo_path:null}:null,error}),
   then:(ok,no)=>Promise.resolve({
    data:table==="crew_notifications"?[]:null,error
   }).then(ok,no)
  }
  return q
 }
 const db={
  auth:{getUser:async()=>({data:{user:auth?{id:user}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push(["rpc",name,args])
   if(name==="upt_current_session_context")return {data:[actor],error:null}
   if(name==="upt_is_admin")return {data:role==="admin"||owner,error:null}
   if(name==="upt_can_manage_administration")return {data:role==="admin"||owner,error:null}
   if(name==="upt_require_first_profile")return {data:null,error}
   if(name==="upt_admin_receive_inventory_batch")return {data:1,error}
   return {data:null,error}
  },
  from:table=>{calls.push(["from",table]);return query(table)},
  storage:{from:bucket=>({remove:async(paths)=>{calls.push(["storage-remove",bucket,paths]);return {error:null}}})}
 }
 return {db,calls}
}
test("one cohesive migration bundle registers exactly 21 original source IDs without overlap",()=>{
 assert.equal(megaPeopleActionIds.length,11)
 assert.equal(megaOperationsActionIds.length,10)
 assert.equal(new Set([...megaPeopleActionIds,...megaOperationsActionIds]).size,21)
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 assert.deepEqual([...megaPeopleActionIds,...megaOperationsActionIds].toSorted(),all.map(v=>id(v[0])).toSorted())
 for(const [name]of all){
  const action=id(name)
  assert.ok(registry.includes('"'+action+'"'),name)
  assert.equal(megaPeopleAllowed(action)||megaOperationsAllowed(action),true,name)
  const source=readFileSync(new URL("../../lib/actions/"+name.split("#")[0],import.meta.url),"utf8")
  assert.ok(source.includes("function "+name.split("#")[1]+"("),name)
 }
 for(const fake of ["","__proto__","lib/actions/auth.ts#signIn","lib/actions/uptilldawn.ts#removeTask"])
  assert.equal(megaPeopleAllowed(fake)||megaOperationsAllowed(fake),false)
})
test("all 21 signed actions run their original command/write family with a mock admin session",async()=>{
 for(const [name,fields,operation]of all){
  const f=fixture()
  const selected=id(name)
  const handler=megaPeopleAllowed(selected)?megaPeopleResponse:megaOperationsResponse
  const response=await handler(request(name,fields),f.db,selected)
  assert.equal(response.status,200,name)
  const result=await response.json()
  assert.ok(result.redirect||result.refresh,name)
  if(operation==="crew_notifications"){
   assert.ok(f.calls.some(x=>x[0]==="from"&&x[1]===operation),name)
  }else if(["staff_pay_rates","knowledge_articles","qr_resources","inventory_items","events"].includes(operation)){
   assert.ok(f.calls.some(x=>["insert","update"].includes(x[0])&&x[1]===operation),name)
  }else{
   assert.ok(f.calls.some(x=>x[0]==="rpc"&&x[1]===operation),name)
  }
  assert.ok(f.calls.some(x=>x[0]==="rpc"&&x[1]==="upt_current_session_context"),name)
 }
})
test("signed identity, blocked account and ordinary staff are denied on admin workflows",async()=>{
 for(const [name,fields] of [...people,...operations.filter(x=>![
  "reopenOperationalChecklistItem","markAllNotificationsRead"
 ].some(alias=>x[0].endsWith("#"+alias)))]){
  const action=id(name),handler=megaPeopleAllowed(action)?megaPeopleResponse:megaOperationsResponse
  for(const options of [{auth:false},{approved:false},{blocked:true},{role:"staff"}]){
   const f=fixture(options)
   const response=await handler(request(name,fields),f.db,action)
   assert.equal(response.status,options.auth===false?401:422,name+" "+JSON.stringify(options))
   assert.equal(f.calls.some(x=>["insert","update"].includes(x[0])||x[0]==="rpc"&&
    x[1].startsWith("upt_admin_")||x[1]==="upt_remove_task_assignment"),false,"Denied mutation "+name)
  }
 }
})
test("malformed args, forged IDs and cross-site posts never reach signed database",async()=>{
 const [name,fields]=people[0],action=id(name)
 for(const [r,status]of [
  [request(name,fields,{origin:"https://evil.invalid"}),403],
  [request(name,fields,{site:"cross-site"}),403],
  [request(name,fields,{actualId:id(people[1][0])}),404],
  [request(name,fields,{args:[]}),400],
  [request(name,fields,{raw:"{"}),400]
 ]){
  const f=fixture()
  const response=await megaPeopleResponse(r,f.db,action)
  assert.equal(response.status,status)
  assert.deepEqual(f.calls,[])
 }
})
test("worker-wide public disabled write gate rejects all 21 without legacy forwarding",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("MAIN_FORWARD_FORBIDDEN")}}}
 for(const [name,fields]of all){
  const result=await app.request(request(name,fields),{},env)
  assert.equal(result.status,503,name)
  assert.deepEqual(await result.json(),{error:"migration_writes_disabled"})
 }
})

test("asset form uses only the audited RPC with exact arguments",async()=>{
 const f=fixture()
 const name="platform.ts#updateAssetMetadata"
 const response=await megaOperationsResponse(request(name,{item_id:task,asset_code:"TEST",reorder_threshold:"2",unit_cost:"3.5",asset_notes:"note"}),f.db,id(name))
 assert.equal(response.status,200)
 const call=f.calls.find(x=>x[0]==="rpc"&&x[1]==="upt_update_inventory_asset_form")
 assert.ok(call)
 assert.equal(call[2].p_item,task)
 assert.equal(call[2].p_reorder_threshold,2)
 assert.equal(call[2].p_unit_cost_cents,350)
 assert.equal(call[2].p_notes,"note")
 assert.equal(f.calls.some(x=>x[0]==="update"&&x[1]==="inventory_items"),false)
})
