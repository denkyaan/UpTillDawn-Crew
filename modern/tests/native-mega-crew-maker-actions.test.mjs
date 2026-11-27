import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {encode} from "../../lib/migration/wire.ts"
import app from "../src/api/worker.ts"
import {megaCrewEventActionIds,megaCrewEventAllowed,megaCrewEventResponse} from "../src/api/native-mega-crew-event-actions.ts"
import {megaMakerActionIds,megaMakerAllowed,megaMakerResponse,originalGodLogout} from "../src/api/native-mega-maker-actions.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const user="aaaabbbb-cccc-4ddd-8eee-000000000001"
const target="aaaabbbb-cccc-4ddd-8eee-000000000002"
const event="aaaabbbb-cccc-4ddd-8eee-000000000003"
const workplace="aaaabbbb-cccc-4ddd-8eee-000000000004"
const start="2026-12-01T16:00:00+01:00",end="2026-12-02T05:00:00+01:00"
const cases=[
 ["events.ts#createEvent",{name:"QA event",start_at:start,end_at:end}],
 ["events.ts#archiveEventWithState",{event_id:event}],
 ["events.ts#restoreEventWithState",{event_id:event}],
 ["uptilldawn.ts#createEvent",{name:"QA event",start_at:start,end_at:end}],
 ["uptilldawn.ts#addWorkplace",{event_id:event,name:"Lockers",
   sort_order:"10",minimum_staff:"1",target_staff:"2",maximum_staff:"4",
   default_shift_start:start,default_shift_end:end}],
 ["uptilldawn.ts#updateWorkplace",{workplace_id:workplace,name:"Bar",
   sort_order:"12",minimum_staff:"1",target_staff:"2",maximum_staff:"5",
   default_shift_start:start,default_shift_end:end,is_active:"on"}],
 ["uptilldawn.ts#addEventMember",{event_id:event,user_id:target}],
 ["uptilldawn.ts#addAvailableEventMembers",{event_id:event,user_id:target}],
 ["uptilldawn.ts#assignAvailableCrewShift",{event_id:event,user_id:target,
   workplace_id:workplace,start,end,role_name:"Driver",shift_kind:"event"}],
 ["uptilldawn.ts#assignResponsible",{workplace_id:workplace,user_id:target}],
 ["uptilldawn.ts#demoteResponsibleToStaff",{workplace_id:workplace,user_id:target}],
 ["auth.ts#enterNormalAppFromMakerSession",{portal:"staff"}],
 ["god-mode.ts#enterGodModeFromMakerSession",{}],
 ["god-mode.ts#godModeLogout",{}],
 ["god-mode.ts#returnToNormalAppFromGodMode",{}],
]
const id=name=>"lib/actions/"+name
function post(name,values={},opts={}){
 const fd=new FormData()
 for(const [key,value]of Object.entries(values))fd.append(key,String(value))
 const action=id(name)
 const args=name==="events.ts#archiveEventWithState"||name==="events.ts#restoreEventWithState"?
  [{error:null},fd]:
  ["god-mode.ts#enterGodModeFromMakerSession","god-mode.ts#godModeLogout","god-mode.ts#returnToNormalAppFromGodMode"].includes(name)?
   []:[fd]
 const body=new FormData()
 body.set("_id",opts.actualId??action)
 body.set("_args",opts.raw??JSON.stringify(encode(args,body)))
 return new Request(origin+"/api/migration/actions",{
  method:"POST",headers:{
   Origin:opts.origin??origin,"Sec-Fetch-Site":opts.site??"same-origin",
   "X-UpTillDawn-Action-Hint":action,
   ...(opts.cookie?{Cookie:opts.cookie}:{})
  },body
 })
}
function fixture({owner=false,admin=true,approved=true,blocked=false,verified=true,rpcError=null}={}){
 const calls=[]
 const actor={id:user,role:"admin",approved,account_blocked:blocked,is_owner:owner,effective_role:"admin"}
 let deleted=false
 const queries=(name)=>{
  const q={
   select:()=>q,eq:()=>q,neq:()=>q,in:()=>q,order:()=>q,limit:()=>q,
   insert:payload=>{calls.push(["insert",name,payload]);return q},
   upsert:payload=>{calls.push(["upsert",name,payload]);return q},
   update:payload=>{calls.push(["update",name,payload]);return q},
   delete:()=>{deleted=true;calls.push(["delete",name]);return q},
   single:async()=>({data:
    name==="events"?{id:event}:
    name==="workplaces"?{event_id:event,is_active:true}:
    name==="profiles"?{id:target,approved:true,role:"staff"}:null,
    error:null}),
   maybeSingle:async()=>({data:
    name==="event_availability"?{response:"can",setup_available:true,breakdown_available:true}:
    name==="event_members"?{user_id:target}:
    name==="responsible_assignments"?{event_id:event,workplace_id:workplace,user_id:target}:null,
    error:null}),
   then:(ok,no)=>{
    let data=null
    if(name==="event_availability")data=[{user_id:target}]
    else if(name==="profiles")data=[{id:target,role:"staff"}]
    else if(name==="shifts")data=deleted?[]:[{workplace_id:workplace,scheduled_start:start,scheduled_end:end}]
    else if(name==="responsible_assignments")data=[]
    return Promise.resolve({data,error:null}).then(ok,no)
   }
  }
  return q
 }
 const db={
  auth:{getUser:async()=>({data:{user:verified?{id:user}:null},error:null})},
  rpc:(name,args)=>{
   if(name==="upt_admin_profiles"){
    calls.push(["rpc",name,args]);return queries("profiles")
   }
   calls.push(["rpc",name,args])
   if(name==="upt_current_session_context")return {data:[actor],error:null}
   if(name==="upt_is_admin")return {data:admin,error:null}
   if(name==="upt_current_is_owner")return {data:owner,error:null}
   if(name==="upt_set_admin_role_mode")return {data:args?.p_role,error:null}
   if(name==="upt_god_login_owner")return {data:"qa-synthetic-owner-token",error:null}
   if(name==="upt_god_logout")return {data:null,error:null}
   return {data:null,error:rpcError}
  },
  from:name=>{calls.push(["from",name]);return queries(name)}
 }
 return {db,calls}
}
test("15 new source IDs are distinct and match the original registered handlers",()=>{
 assert.equal(megaCrewEventActionIds.length,11)
 assert.equal(megaMakerActionIds.length,4)
 const all=[...megaCrewEventActionIds,...megaMakerActionIds]
 assert.equal(new Set(all).size,15)
 assert.deepEqual(all.toSorted(),cases.map(x=>id(x[0])).toSorted())
 const registry=readFileSync(new URL("../../lib/migration/original-action-registry.ts",import.meta.url),"utf8")
 for(const name of all)assert.ok(registry.includes('"'+name+'"'),name)
 for(const [name]of cases){
  assert.equal(megaCrewEventAllowed(id(name))||megaMakerAllowed(id(name)),true,name)
  const original=readFileSync(new URL("../../lib/actions/"+name.split("#")[0],import.meta.url),"utf8")
  assert.ok(original.includes("function "+name.split("#")[1]+"("),name)
 }
})
test("original 11 event/crew paths use signed DB role checks and source-specific resource writes",async()=>{
 for(const [name,fields]of cases.slice(0,11)){
  const f=fixture(),action=id(name)
  const r=await megaCrewEventResponse(post(name,fields),f.db,action)
  assert.equal(r.status,200,name)
  assert.ok(f.calls.some(x=>x[0]==="rpc"&&x[1]==="upt_is_admin"),name)
  assert.ok(f.calls.some(x=>["insert","update","upsert","delete"].includes(x[0])||
   x[0]==="rpc"&&["upt_archive_event","upt_restore_event","upt_force_archive_event","upt_create_shift","upt_admin_set_account","upt_admin_set_responsible_assignment"].includes(x[1])),name)
 }
})
test("responsible assignment and demotion use exactly one atomic signed RPC and fail closed",async()=>{
 for(const [name,assign] of [["uptilldawn.ts#assignResponsible",true],["uptilldawn.ts#demoteResponsibleToStaff",false]]){
  const fields={workplace_id:workplace,user_id:target},action=id(name)
  for(const options of [{},{admin:false},{rpcError:{message:"rejected"}}]){
   const f=fixture(options)
   const r=await megaCrewEventResponse(post(name,fields),f.db,action)
   assert.equal(r.status,options.admin===false||options.rpcError?422:200,name)
   assert.deepEqual(f.calls.filter(x=>x[0]==="rpc"&&x[1]==="upt_admin_set_responsible_assignment"),
    options.admin===false?[]:[["rpc","upt_admin_set_responsible_assignment",{p_workplace:workplace,p_user:target,p_assign:assign}]],name)
   assert.equal(f.calls.some(x=>["from","insert","update","upsert","delete"].includes(x[0])||
    x[0]==="rpc"&&x[1]==="upt_admin_set_account"),false,name)
  }
 }
})
test("Maker portal mode, God Mode cookie, return path and signed logout preserve ownership",async()=>{
 const f=fixture({owner:true})
 for(const [name,fields]of cases.slice(11)){
  const r=await megaMakerResponse(post(name,fields,{
   cookie:"uptilldawn-god-session=qa-synthetic-owner-token"
  }),f.db,id(name))
  assert.equal(r.status,200,name)
  assert.ok((await r.json()).redirect,name)
  if(name.endsWith("enterGodModeFromMakerSession"))
   assert.ok(r.headers.get("set-cookie")?.includes("HttpOnly"),name)
 }
 for(const [name,fields]of cases.slice(11).filter(x=>!x[0].endsWith("godModeLogout"))){
  const denied=fixture({owner:false})
  const r=await megaMakerResponse(post(name,fields),denied.db,id(name))
  assert.equal((await r.json()).redirect,"/unauthorized",name)
  assert.ok(!denied.calls.some(x=>x[0]==="rpc"&&x[1]==="upt_god_login_owner"))
 }
 const loggedOut=await originalGodLogout(post("god-mode.ts#godModeLogout"),null)
 assert.equal((await loggedOut.json()).redirect,"/login/admin")
 assert.ok(loggedOut.headers.get("set-cookie")?.includes("Max-Age=0"))
})
test("signed role, origin and exact action ID are never inferred from browser input",async()=>{
 for(const [name,fields] of cases.slice(0,11)){
  const denied=fixture({admin:false})
  const r=await megaCrewEventResponse(post(name,fields),denied.db,id(name))
  assert.equal(r.status,422,name)
  assert.equal(denied.calls.some(x=>["insert","update","upsert","delete"].includes(x[0])),false,name)
 }
 const name="uptilldawn.ts#addEventMember",base=id(name)
 for(const [opts,status]of [
  [{origin:"https://attacker.invalid"},403],
  [{site:"cross-site"},403],
  [{actualId:id("uptilldawn.ts#updateWorkplace")},404],
  [{raw:"{"},400]
 ]){
  const f=fixture()
  const r=await megaCrewEventResponse(post(name,cases[6][1],opts),f.db,base)
  assert.equal(r.status,status)
  assert.equal(f.calls.length,0)
 }
})
test("public deployed Worker rejects all fifteen new actions before forwarding to legacy Main",async()=>{
 const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",
  SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{throw Error("DO_NOT_FORWARD_MAIN")}}}
 for(const [name,fd]of cases){
  const r=await app.request(post(name,fd),{},env)
  assert.equal(r.status,503,name)
  assert.deepEqual(await r.json(),{error:"migration_writes_disabled"})
 }
})
