import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {
 nativeCatalogActionIds,nativeCatalogAdminActionIds,nativeCatalogManagerActionIds,
 nativeCatalogActionAllowed,originalCatalogCommand,nativeCatalogActionResponse
} from "../src/api/native-catalog-event-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const event="aaaabbbb-cccc-4ddd-8eee-000000000001"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000002"
const person="aaaabbbb-cccc-4ddd-8eee-000000000003"
const item="aaaabbbb-cccc-4ddd-8eee-000000000004"
const created="aaaabbbb-cccc-4ddd-8eee-000000000005"
const other="aaaabbbb-cccc-4ddd-8eee-000000000006"
const start="2026-11-30T18:00:00+01:00",end="2026-12-01T05:00:00+01:00"
const cases=[
 ["workplace-catalog.ts#createCatalogWorkplace",{
  name:" Stage manager ",description:" Door and crew ",sort_order:"2",
  minimum_staff:"1",target_staff:"3",maximum_staff:"5"
 },"upt_create_workplace_catalog",{
  p_name:"Stage manager",p_description:"Door and crew",p_sort_order:2,
  p_minimum_staff:1,p_target_staff:3,p_maximum_staff:5
 },"sync-future"],
 ["workplace-catalog.ts#updateCatalogWorkplace",{
  workplace_id:workplace,name:" Lockers ",minimum_staff:"2",target_staff:"3",
  maximum_staff:"5",is_active:"on",sort_order:"4"
 },"upt_update_workplace_catalog",{
  p_workplace:workplace,p_name:"Lockers",p_description:undefined,p_sort_order:4,
  p_minimum_staff:2,p_target_staff:3,p_maximum_staff:5,p_is_active:true
 },"sync-future"],
 ["workplace-catalog.ts#createCatalogItem",{
  workplace_id:workplace,name:" Lanyard ",category:" Equipment ",quantity:"4"
 },"upt_create_workplace_catalog_item",{
  p_workplace:workplace,p_name:"Lanyard",p_category:"Equipment",p_quantity:4
 },"sync-future"],
 ["workplace-catalog.ts#updateCatalogItem",{
  item_id:item,name:" Cable ties ",category:" Consumables ",quantity:"0",is_active:"on"
 },"upt_update_workplace_catalog_item",{
  p_item:item,p_name:"Cable ties",p_category:"Consumables",p_quantity:0,p_is_active:true
 },"sync-future"],
 ["events.ts#captureEventTemplate",{
  event_id:event,template_name:" Winter setup ",section_workplaces:"on",
  section_briefing:"on",section_inventory:"on"
 },"upt_capture_event_template",{
  p_event:event,p_name:"Winter setup",p_sections:["workplaces","briefing","inventory"]
 },undefined],
 ["events.ts#applyEventTemplate",{
  template_id:item,name:" Winter event ",start_at:start,end_at:end,
  venue:" Venue ",address:" Belgium "
 },"upt_apply_event_template_v2",{
  p_template:item,p_name:"Winter event",p_start:start,p_end:end,
  p_venue:"Venue",p_address:"Belgium"
 },"sync-created"],
 ["uptilldawn.ts#duplicateEvent",{
  event_id:event,name:" Event copy ",start_at:start,end_at:end
 },"upt_duplicate_event",{
  p_event:event,p_name:"Event copy",p_start:start,p_end:end
 },undefined],
 ["uptilldawn.ts#archiveEvent",{event_id:event},"upt_archive_event",{p_event:event},undefined],
 ["uptilldawn.ts#deleteEvent",{event_id:event},"upt_archive_event",{p_event:event},undefined],
 ["uptilldawn.ts#createOperationalChecklist",{
  workplace_id:workplace,kind:"opening",title:" Check-in setup ",
  description:" Before doors "
 },"upt_create_operational_checklist",{
  p_event:undefined,p_workplace:workplace,p_kind:"opening",
  p_title:"Check-in setup",p_description:"Before doors"
 },"read-workplace"]
]
const id=name=>"lib/actions/"+name
function fd(fields={}){
 const result=new FormData()
 for(const [key,value]of Object.entries(fields))result.set(key,value)
 return result
}
function post(key,fields={},options={}){
 const body=new FormData()
 body.set("_id",options.actualId??key)
 body.set("_args",options.raw??JSON.stringify(encode(options.args??[fd(fields)],body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",
  headers:{Origin:options.origin??origin,"Sec-Fetch-Site":options.site??"same-origin",
   "X-UpTillDawn-Action-Hint":key},
  body
 })
}
function fixture({
 signed=true,approved=true,admin=true,blocked=false,role="responsible_lead",
 effectiveRole=role,events=[{id:event},{id:other}],workplaceEvent=event,
 businessError=null,createdEvent=created
}={}){
 const calls=[]
 const db={
  auth:{getUser:async()=>({data:{user:signed?{id:person}:null},error:null})},
  rpc:async(name,args)=>{
   calls.push([name,args])
   if(name==="upt_is_approved")return {data:approved,error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   if(name==="upt_current_profile")return {data:[{approved,account_blocked:blocked,role}],error:null}
   if(name==="upt_current_effective_role")return {data:effectiveRole,error:null}
   if(name==="upt_apply_event_template_v2")return {data:businessError?null:createdEvent,error:businessError}
   return {data:null,error:businessError&&name!=="upt_sync_workplace_catalog_to_event"?businessError:null}
  },
  from:table=>{
   calls.push(["from",table])
   if(table==="events")return {
    select:cols=>({
     neq:(column,value)=>({
      gte:async(field,cutoff)=>{
       calls.push(["future-events",{cols,column,value,field,cutoff}])
       return {data:events,error:null}
      }
     })
    })
   }
   if(table==="workplaces")return{
    select:cols=>({
     eq:(column,id)=>({
      single:async()=>{
       calls.push(["workplace-lookup",{cols,column,id}])
       return {data:workplaceEvent?{event_id:workplaceEvent}:null,error:null}
      }
     })
    })
   }
   throw Error("Unexpected table "+table)
  }
 }
 return {db,calls}
}
test("ten action IDs exactly correspond to existing original source names and SQL calls",()=>{
 assert.equal(nativeCatalogActionIds.length,10)
 assert.equal(nativeCatalogAdminActionIds.length,9)
 assert.equal(nativeCatalogManagerActionIds.length,1)
 assert.deepEqual([...nativeCatalogActionIds].sort(),cases.map(x=>id(x[0])).sort())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const [name,fields,rpc,args,postAction]of cases){
  const key=id(name)
  assert.ok(registry.includes('"'+key+'"'),name)
  const file=name.split("#")[0]
  const original=readFileSync(new URL("../../lib/actions/"+file,import.meta.url),"utf8")
  assert.ok(original.includes("rpc('"+rpc+"'"),"Original RPC mismatch "+name)
  assert.equal(nativeCatalogActionAllowed(key),true)
  assert.deepEqual(originalCatalogCommand(key,fd(fields)),{rpc,args,...(postAction?{post:postAction}:{})},name)
 }
 for(const bad of ["","__proto__","../../etc","lib/actions/auth.ts#signIn",
  "lib/actions/workplace-catalog.ts#syncCatalogToEvent",
  "lib/actions/events.ts#archiveEventWithState"])
  assert.equal(nativeCatalogActionAllowed(bad),false)
})
test("catalog CRUD preserves the original sync of all eligible future events",async()=>{
 for(const [name,fields,rpc,args,postAction]of cases.filter(c=>c[4]==="sync-future")){
  const key=id(name),f=fixture()
  const r=await nativeCatalogActionResponse(post(key,fields),f.db,key)
  assert.equal(r.status,200,name)
  assert.deepEqual(await r.json(),{value:["undefined"],refresh:true},name)
  const syncs=f.calls.filter(x=>x[0]==="upt_sync_workplace_catalog_to_event")
  assert.deepEqual(syncs,[
   ["upt_sync_workplace_catalog_to_event",{p_event:event}],
   ["upt_sync_workplace_catalog_to_event",{p_event:other}]
  ],name)
  assert.deepEqual(f.calls.slice(0,3),[
   ["upt_is_approved",undefined],["upt_is_admin",{uid:person}],[rpc,args]
  ],name)
  assert.ok(f.calls.some(x=>x[0]==="future-events"&&x[1].column==="status"&&
   x[1].value==="archived"&&x[1].field==="end_at"),name)
 }
})
test("template create applies original v2 procedure and synchronizes only the new event",async()=>{
 const [name,fields,rpc,args]=cases[5],key=id(name),f=fixture()
 assert.equal((await nativeCatalogActionResponse(post(key,fields),f.db,key)).status,200)
 assert.deepEqual(f.calls.slice(0,4),[
  ["upt_is_approved",undefined],["upt_is_admin",{uid:person}],
  [rpc,args],["upt_sync_workplace_catalog_to_event",{p_event:created}]
 ])
 assert.equal(f.calls.some(x=>x[0]==="from"),false)
 const failed=fixture({createdEvent:null})
 assert.equal((await nativeCatalogActionResponse(post(key,fields),failed.db,key)).status,422)
 assert.equal(failed.calls.some(x=>x[0]==="upt_sync_workplace_catalog_to_event"),false)
})
test("checklist derives event id only from the signed workplace lookup and original responsible role",async()=>{
 const [name,fields,rpc,args]=cases[9],key=id(name)
 const f=fixture({admin:false,role:"responsible_lead"})
 const r=await nativeCatalogActionResponse(post(key,{...fields,event_id:other}),f.db,key)
 assert.equal(r.status,200)
 assert.deepEqual(f.calls.slice(0,5),[
  ["upt_current_profile",undefined],["upt_current_effective_role",undefined],
  ["from","workplaces"],
  ["workplace-lookup",{cols:"event_id",column:"id",id:workplace}],
  [rpc,{...args,p_event:event}]
 ])
 const denied=fixture({admin:false,role:"staff",effectiveRole:"staff"})
 assert.equal((await nativeCatalogActionResponse(post(key,fields),denied.db,key)).status,422)
 assert.equal(denied.calls.some(x=>x[0]===rpc),false)
 const noWorkplace=fixture({workplaceEvent:null})
 assert.equal((await nativeCatalogActionResponse(post(key,fields),noWorkplace.db,key)).status,422)
 assert.equal(noWorkplace.calls.some(x=>x[0]===rpc),false)
})
test("unauthenticated, unapproved, blocked, and non-admin callers cannot invoke business RPCs",async()=>{
 for(const [name,fields,rpc]of cases){
  const key=id(name)
  for(const options of [
   {signed:false},{approved:false},
   ...(name.includes("createOperationalChecklist")?
    [{blocked:true},{role:"staff",effectiveRole:"staff"}]:[{admin:false}])
  ]){
   const f=fixture(options)
   const r=await nativeCatalogActionResponse(post(key,fields),f.db,key)
   assert.equal(r.status,options.signed===false?401:422,name)
   assert.equal(f.calls.some(x=>x[0]===rpc),false,"Unauthorized RPC "+name)
  }
 }
})
test("malformed data, invalid capacity, forged action, and cross-site requests fail closed",async()=>{
 const [name,fields]=cases[0],key=id(name)
 for(const [request,status]of [
  [post(key,fields,{origin:"https://evil.invalid"}),403],
  [post(key,fields,{site:"cross-site"}),403],
  [post(key,fields,{actualId:id(cases[1][0])}),404],
  [post(key,fields,{args:[]}),400],
  [post(key,fields,{raw:"{"}),400]
 ]){
  const f=fixture()
  const r=await nativeCatalogActionResponse(request,f.db,key)
  assert.equal(r.status,status)
  assert.deepEqual(f.calls,[])
 }
 const invalid=[
  [cases[0],{...fields,target_staff:"0",minimum_staff:"3"}],
  [cases[0],{...fields,maximum_staff:"1"}],
  [cases[2],{...cases[2][1],quantity:"-2"}],
  [cases[4],{...cases[4][1],section_workplaces:"",section_briefing:"",section_inventory:""}],
  [cases[5],{...cases[5][1],end_at:start}],
  [cases[6],{...cases[6][1],event_id:"not-a-uuid"}],
  [cases[9],{...cases[9][1],kind:"remove"}]
 ]
 for(const [[name],fields]of invalid){
  const key=id(name),f=fixture()
  const r=await nativeCatalogActionResponse(post(key,fields),f.db,key)
  assert.equal(r.status,422,name)
  assert.equal(f.calls.some(x=>x[0]===cases.find(y=>y[0]===name)[2]),false)
 }
})
test("DB error responses redact SQL messages and never claim successful writes",async()=>{
 for(const [name,fields]of cases){
  const key=id(name),f=fixture({businessError:{message:"SECRET_SQL_INTERNAL"}})
  const r=await nativeCatalogActionResponse(post(key,fields),f.db,key)
  assert.equal(r.status,422,name)
  assert.deepEqual(await r.json(),{
   error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code:"action_failed"
  })
 }
})
test("public Main-QA write flag blocks all ten before any original source forwarding",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("UNEXPECTED_MAIN_FORWARD")}}}
 for(const [name,fields]of cases){
  const r=await app.request(post(id(name),fields),{},env)
  assert.equal(r.status,503,name)
  assert.deepEqual(await r.json(),{error:"migration_writes_disabled"})
 }
})
