import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {nativeWaveNineActionIds,nativeWaveNineAllowed,nativeWaveNineResponse} from "../src/api/native-wave-nine-safe-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const target="aaaabbbb-cccc-4ddd-8eee-000000000002"
const event="aaaabbbb-cccc-4ddd-8eee-000000000003"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000004"
const item="aaaabbbb-cccc-4ddd-8eee-000000000005"
const cases=[
 ["uptilldawn.ts#createInventoryTextEntry",{event_id:event,workplace_id:workplace,title:"Inventaris",content:"6 kisten"}],
 ["uptilldawn.ts#createPriceListTextEntry",{event_id:event,workplace_id:workplace,workplace_name:"Bar",price_list_text:"Water 2 EUR"}],
 ["uptilldawn.ts#completeOperationalChecklistItem",{item_id:item}],
 ["personnel.ts#deletePersonnel",{user_id:target}]
]
function post(name,fields={},opts={}){
 const original="lib/actions/"+name
 const fd=new FormData()
 for(const [key,value] of Object.entries(fields))fd.append(key,value)
 const form=new FormData()
 form.set("_id",opts.actualId??original)
 form.set("_args",JSON.stringify(encode([fd],form)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{Origin:opts.origin??origin,"Sec-Fetch-Site":"same-origin",
   "X-UpTillDawn-Action-Hint":original},body:form
 })
}
function fixture({admin=true,role="admin",approved=true,rpcError=null,uploadError=null}={}){
 const calls=[]
 const actor={id:user,role,approved,account_blocked:false,is_owner:false,effective_role:role}
 const table=name=>{
  const q={
   select:()=>q,eq:()=>q,in:()=>q,
   single:async()=>({data:{event_id:event,is_active:true},error:null}),
   maybeSingle:async()=>({data:{id:target,profile_photo_url:"photo.jpg"},error:null}),
   then:(accept,reject)=>Promise.resolve({
    data:name==="work_attachments"?[{storage_path:"work-photo.jpg"}]:[],error:null
   }).then(accept,reject)
  }
  return q
 }
 const db={
  auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
  rpc:(name,args)=>{calls.push(["rpc",name,args])
   if(name==="upt_admin_profiles")return table("profiles")
   if(name==="upt_current_session_context")return {data:[actor],error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   return {data:null,error:rpcError}
  },
  from:name=>{calls.push(["from",name]);return table(name)},
  storage:{from:bucket=>({
   upload:async(path,blob,opts)=>{calls.push(["upload",bucket,path,blob.size,opts]);return {error:uploadError}},
   remove:async(paths)=>{calls.push(["remove",bucket,paths]);return {error:null}}
  })}
 }
 return {db,calls}
}
test("all four ninth-wave source actions are exact, unique and registered",()=>{
 assert.equal(nativeWaveNineActionIds.length,4)
 assert.equal(new Set(nativeWaveNineActionIds).size,4)
 assert.deepEqual(nativeWaveNineActionIds.toSorted(),cases.map(([name])=>"lib/actions/"+name).toSorted())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const [name] of cases){
  const id="lib/actions/"+name
  assert.equal(nativeWaveNineAllowed(id),true)
  assert.ok(registry.includes('"'+id+'"'))
  const original=readFileSync(new URL("../../lib/actions/"+name.split("#")[0],import.meta.url),"utf8")
  assert.ok(original.includes("function "+name.split("#")[1]+"("))
 }
})
test("signed admin creates original document metadata and matching text blob",async()=>{
 for(const [name,fields] of cases.slice(0,2)){
  const f=fixture()
  const r=await nativeWaveNineResponse(post(name,fields),f.db,"lib/actions/"+name)
  assert.equal(r.status,200,name)
  const upload=f.calls.find(c=>c[0]==="upload")
  const rpc=f.calls.find(c=>c[0]==="rpc"&&c[1]==="upt_create_event_document")
  assert.ok(upload&&rpc)
  assert.equal(upload[1],"work-media")
  assert.equal(upload[3],new TextEncoder().encode(fields.content||fields.price_list_text).byteLength)
  assert.equal(rpc[2].p_storage_path,upload[2])
  assert.equal(rpc[2].p_offline_critical,true)
  assert.equal(rpc[2].p_title,name.includes("PriceList")?"Prijslijst · Bar":"Inventaris")
  assert.ok(f.calls.some(c=>c[1]==="upt_is_admin"))
 }
})
test("checklist permits approved staff, with and without a valid PNG",async()=>{
 const name=cases[2][0],id="lib/actions/"+name
 let f=fixture({admin:false,role:"staff"})
 let r=await nativeWaveNineResponse(post(name,cases[2][1]),f.db,id)
 assert.equal(r.status,200)
 assert.equal(f.calls.find(x=>x[1]==="upt_set_operational_checklist_item")[2].p_photo_path,undefined)
 const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],"check.png",{type:"image/png"})
 f=fixture({admin:false,role:"staff"})
 r=await nativeWaveNineResponse(post(name,{item_id:item,photo:png}),f.db,id)
 assert.equal(r.status,200)
 const upload=f.calls.find(x=>x[0]==="upload")
 assert.ok(upload[2].includes("/checklist/"+item+"/"))
 assert.equal(f.calls.find(x=>x[1]==="upt_set_operational_checklist_item")[2].p_photo_path,upload[2])
})
test("invalid origin, mismatched IDs, denied role and self-deletion never mutate",async()=>{
 const id="lib/actions/uptilldawn.ts#createInventoryTextEntry"
 for(const opts of [{origin:"https://attacker.invalid"},{actualId:"lib/actions/personnel.ts#deletePersonnel"}]){
  const f=fixture()
  const r=await nativeWaveNineResponse(post(cases[0][0],cases[0][1],opts),f.db,id)
  assert.equal(r.status,opts.origin?403:404)
  assert.equal(f.calls.length,0)
 }
 for(const [name,fields] of [...cases.slice(0,2),cases[3]]){
  const f=fixture({admin:false})
  const r=await nativeWaveNineResponse(post(name,fields),f.db,"lib/actions/"+name)
  assert.equal(r.status,422)
  assert.equal(f.calls.some(x=>["upload","remove"].includes(x[0])||x[1]==="upt_admin_set_account"),false)
 }
 const f=fixture()
 const own=await nativeWaveNineResponse(post("personnel.ts#deletePersonnel",{user_id:user}),f.db,
  "lib/actions/personnel.ts#deletePersonnel")
 assert.equal(own.status,422)
 assert.equal(f.calls.some(x=>x[0]==="remove"),false)
})
test("document/checklist RPC failure rolls back newly uploaded media",async()=>{
 for(const [name,fields] of cases.slice(0,2)){
  const f=fixture({rpcError:{code:"TEST_REJECT"}})
  const r=await nativeWaveNineResponse(post(name,fields),f.db,"lib/actions/"+name)
  assert.equal(r.status,422)
  assert.deepEqual(f.calls.find(x=>x[0]==="remove")[2],[f.calls.find(x=>x[0]==="upload")[2]])
 }
 const png=new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0])],"ok.png",{type:"image/png"})
 const f=fixture({role:"staff",admin:false,rpcError:{code:"TEST_REJECT"}})
 const r=await nativeWaveNineResponse(post(cases[2][0],{item_id:item,photo:png}),f.db,
  "lib/actions/uptilldawn.ts#completeOperationalChecklistItem")
 assert.equal(r.status,422)
 assert.equal(f.calls.some(x=>x[0]==="remove"),true)
})
test("personnel deletion uses the signed profile RPC and never removes media if account deletion fails",async()=>{
 const [name,fields]=cases[3],id="lib/actions/"+name
 for(const rpcError of [null,{code:"PROTECTED_ACCOUNT"}]){
  const f=fixture({rpcError})
  const r=await nativeWaveNineResponse(post(name,fields),f.db,id)
  assert.equal(r.status,rpcError?422:200)
  assert.ok(f.calls.some(x=>x[0]==="rpc"&&x[1]==="upt_admin_profiles"))
  assert.ok(!f.calls.some(x=>x[0]==="from"&&x[1]==="profiles"))
  const removal=f.calls.findIndex(x=>x[0]==="remove")
  const deletion=f.calls.findIndex(x=>x[0]==="rpc"&&x[1]==="upt_admin_set_account")
  assert.ok(deletion>=0)
  if(rpcError)assert.equal(removal,-1)
  else assert.ok(removal>deletion)
 }
})
test("public deployed Worker rejects all four actions before any backend call",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("UNEXPECTED_FORWARD")}}}
 for(const [name,fields] of cases){
  const res=await app.request(post(name,fields),{},env)
  assert.equal(res.status,503,name)
  assert.deepEqual(await res.json(),{error:"migration_writes_disabled"})
 }
})
