import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {
 nativeInventoryActionIds,nativeInventoryManagerActionIds,nativeInventoryMemberActionIds,
 nativeInventoryActionAllowed,originalInventoryCommand,nativeInventoryActionResponse
} from "../src/api/native-inventory-checklist-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const actor="aaaabbbb-cccc-4ddd-8eee-000000000001"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000002"
const item="aaaabbbb-cccc-4ddd-8eee-000000000003"
const issue="aaaabbbb-cccc-4ddd-8eee-000000000004"
const request="aaaabbbb-cccc-4ddd-8eee-000000000005"
const template="aaaabbbb-cccc-4ddd-8eee-000000000006"
const event="aaaabbbb-cccc-4ddd-8eee-000000000007"
const checklist="aaaabbbb-cccc-4ddd-8eee-000000000008"
const id=n=>"lib/actions/uptilldawn.ts#"+n
const cases=[
 ["createInventoryItem",{workplace_id:workplace,name:" Spare cable ",category:" Electric ",quantity:"3",item_kind:"asset"},"upt_create_inventory_item",{p_workplace:workplace,p_name:"Spare cable",p_category:"Electric",p_quantity:3,p_item_kind:"asset"},true],
 ["updateInventoryAssetDetails",{item_id:item,item_kind:"asset",asset_code:" AB123 ",barcode:" 301 ",serial_number:" S-S "},"upt_set_inventory_asset_details",{p_item:item,p_kind:"asset",p_asset_code:"AB123",p_barcode:"301",p_serial_number:"S-S"},true],
 ["reportWorkplaceInventoryCondition",{item_id:item,phase:"opening",condition:"missing",quantity:"2",notes:" Review "},"upt_report_workplace_inventory_condition",{p_item:item,p_phase:"opening",p_condition:"missing",p_quantity:2,p_notes:"Review"},true],
 ["restockInventoryItem",{item_id:item,quantity:"8",notes:" New stock "},"upt_restock_inventory_item",{p_item:item,p_quantity:8,p_notes:"New stock"},true],
 ["issueInventoryItem",{item_id:item,user_id:actor,quantity:"1",notes:" Borrowed "},"upt_issue_inventory",{p_item:item,p_user:actor,p_quantity:1,p_notes:"Borrowed"},true],
 ["decideInventorySettlement",{request_id:request,decision:"rejected",note:" Not complete "},"upt_decide_inventory_settlement",{p_request:request,p_decision:"rejected",p_note:"Not complete"},true],
 ["restoreInventoryQuantity",{item_id:item,condition:"damaged",quantity:"2",notes:" Fixed "},"upt_restore_inventory_quantity",{p_item:item,p_condition:"damaged",p_quantity:2,p_notes:"Fixed"},true],
 ["applyOperationalChecklistTemplate",{template_id:template,event_id:event,workplace_id:workplace},"upt_apply_operational_checklist_template",{p_template:template,p_event:event,p_workplace:workplace},true],
 ["addOperationalChecklistItem",{checklist_id:checklist,label:" Test sockets ",required:"on",requires_photo:"on"},"upt_add_operational_checklist_item",{p_checklist:checklist,p_label:"Test sockets",p_required:true,p_requires_photo:true},true],
 ["closeOperationalChecklist",{checklist_id:checklist},"upt_close_operational_checklist",{p_checklist:checklist},true],
 ["reopenOperationalChecklist",{checklist_id:checklist},"upt_reopen_operational_checklist",{p_checklist:checklist},true],
 ["settleInventoryIssue",{issue_id:issue,condition:"returned",quantity:"3",notes:" Returned to stock "},"upt_settle_inventory_issue",{p_issue:issue,p_condition:"returned",p_quantity:3,p_notes:"Returned to stock"},false],
 ["requestInventorySettlement",{issue_id:issue,condition:"missing",quantity:"1",notes:" Not found "},"upt_request_inventory_settlement",{p_issue:issue,p_condition:"missing",p_quantity:1,p_notes:"Not found"},false],
 ["cancelInventorySettlement",{request_id:request},"upt_cancel_inventory_settlement",{p_request:request},false],
]
const fd=values=>{const f=new FormData();for(const [name,value]of Object.entries(values))f.set(name,value);return f}
function requestPost(key,fields,options={}){
 const body=new FormData()
 body.set("_id",options.actualId??key)
 body.set("_args",options.payload??JSON.stringify(encode(options.args??[fd(fields)],body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{
   Origin:options.origin??origin,"Sec-Fetch-Site":options.site??"same-origin",
   "X-UpTillDawn-Action-Hint":key
  },body
 })
}
function fixture({approved=true,blocked=false,role="admin",effectiveRole=role,user=true,error=null}={}){
 const calls=[]
 const db={auth:{getUser:async()=>({data:{user:user?{id:actor}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_current_profile")return {data:[{approved,account_blocked:blocked,role}],error:null}
   if(name==="upt_current_effective_role")return {data:effectiveRole,error:null}
   return {data:null,error}
  }}
 return {db,calls}
}
test("14 exact original action IDs and SQL procedure selectors, no collisions",()=>{
 assert.equal(nativeInventoryManagerActionIds.length,11)
 assert.equal(nativeInventoryMemberActionIds.length,3)
 assert.equal(nativeInventoryActionIds.length,14)
 assert.equal(new Set(nativeInventoryActionIds).size,14)
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 const original=readFileSync(new URL("../../lib/actions/uptilldawn.ts",import.meta.url),"utf8")
 assert.deepEqual([...nativeInventoryActionIds].sort(),cases.map(x=>id(x[0])).sort())
 for(const [name,fields,rpc,args,manager]of cases){
  const key=id(name)
  assert.ok(registry.includes('"'+key+'"'),key)
  assert.ok(original.includes("rpc('"+rpc+"'"),"Original RPC renamed: "+name)
  assert.equal(nativeInventoryActionAllowed(key),true)
  assert.deepEqual(originalInventoryCommand(key,fd(fields)),{rpc,args},name)
  assert.equal(nativeInventoryManagerActionIds.includes(key),manager)
 }
 for(const unknown of ["","__proto__","../private","lib/actions/auth.ts#signIn",
  "lib/actions/uptilldawn.ts#removeOperationalChecklistItem",
  "lib/actions/events.ts#closeEvent"])
  assert.equal(nativeInventoryActionAllowed(unknown),false)
})
test("approved manager is required for 11 manager actions; 3 member actions allow approved staff",async()=>{
 for(const [name,fields,rpc,args,manager]of cases){
  const key=id(name),f=fixture({role:manager?"responsible_lead":"staff"})
  const response=await nativeInventoryActionResponse(requestPost(key,fields),f.db,key)
  assert.equal(response.status,200,name)
  assert.deepEqual(await response.json(),{value:["undefined"],refresh:true})
  assert.deepEqual(f.calls,[
   ["upt_current_profile",undefined],
   ...(manager?[["upt_current_effective_role",undefined]]:[]),
   [rpc,args]
  ],name)
  for(const option of [
   {user:false},{approved:false},
   {blocked:true},
   ...(manager?[{role:"staff"},{role:"promotion"}]:[])
  ]){
   const g=fixture(option)
   const denied=await nativeInventoryActionResponse(requestPost(key,fields),g.db,key)
   assert.equal(denied.status,option.user===false?401:422,name)
   assert.equal(g.calls.some(x=>x[0]===rpc),false,"Unauthorized business RPC "+name)
  }
 }
})
test("approved admin, responsible or effective role must match original current-profile logic",async()=>{
 const [name,fields]=cases[0],key=id(name)
 for(const role of ["admin","responsible_lead"]){
  const f=fixture({role:"staff",effectiveRole:role})
  assert.equal((await nativeInventoryActionResponse(requestPost(key,fields),f.db,key)).status,200)
 }
 const f=fixture({role:"admin",effectiveRole:"staff"})
 assert.equal((await nativeInventoryActionResponse(requestPost(key,fields),f.db,key)).status,422)
 const nullBlocked=fixture({blocked:false,role:"admin"})
 assert.equal((await nativeInventoryActionResponse(requestPost(key,fields),nullBlocked.db,key)).status,200)
})
test("invalid fields, forged actions, origins and JSON fail closed without executing any mutation",async()=>{
 const [name,fields]=cases[0],key=id(name)
 for(const [request,status]of [
  [requestPost(key,fields,{origin:"https://attacker.invalid"}),403],
  [requestPost(key,fields,{site:"cross-site"}),403],
  [requestPost(key,fields,{actualId:id(cases[1][0])}),404],
  [requestPost(key,fields,{args:[]}),400],
  [requestPost(key,fields,{payload:"{"}),400]
 ]){
  const f=fixture()
  const response=await nativeInventoryActionResponse(request,f.db,key)
  assert.equal(response.status,status)
  assert.deepEqual(f.calls,[])
 }
 const invalid=[
  [cases[0],{...cases[0][1],quantity:"0"}],
  [cases[0],{...cases[0][1],item_kind:"weapon"}],
  [cases[1],{...cases[1][1],item_id:"../../etc"}],
  [cases[2],{...cases[2][1],condition:"unclear"}],
  [cases[5],{...cases[5][1],note:"x"}],
  [cases[8],{...cases[8][1],label:""}],
  [cases[12],{...cases[12][1],quantity:"100001"}]
 ]
 for(const [[name],values]of invalid){
  const key=id(name),f=fixture()
  assert.equal((await nativeInventoryActionResponse(requestPost(key,values),f.db,key)).status,422,name)
  assert.equal(f.calls.some(x=>x[0]===cases.find(y=>y[0]===name)[2]),false)
 }
})
test("source RPC errors redact DB metadata and do not counterfeit success",async()=>{
 for(const [name,fields]of cases){
  const key=id(name),f=fixture({error:{message:"PRIVATE token do not show"}})
  const response=await nativeInventoryActionResponse(requestPost(key,fields),f.db,key)
  assert.equal(response.status,422,name)
  assert.deepEqual(await response.json(),{error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"})
 }
})
test("deployed Main-QA Worker blocks all 14 before cookie or backend access",async()=>{
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("NO_LEGACY_SOURCE_FORWARD_ALLOWED")}}}
 for(const [name,fields]of cases){
  const response=await app.request(requestPost(id(name),fields),{},env)
  assert.equal(response.status,503,name)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
})
