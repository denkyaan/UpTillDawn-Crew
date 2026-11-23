import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerBusinessResponse} from "../src/api/native-maker-business-writes.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const cookie="uptilldawn-god-session=signed-maker-token"
const uuid="11111111-1111-4111-8111-111111111111"
const sha="a".repeat(40)
const date="2026-11-21T12:00:00Z"
function request(path,method="POST",body=null,headers={}){
 const h={Origin:origin,...headers}
 if(body!==null)h["Content-Type"]="application/json"
 return new Request(origin+path,{method,headers:h,
  ...(body===null?{}:{body:JSON.stringify(body)})})
}
function fixture({session=true,owner=true,changeError=null,reports=[{id:uuid,status:"new",created_at:date}]}={}){
 const calls=[]
 const db={
  rpc:async(name,args)=>{
   calls.push({name,args})
   if(name==="upt_god_session_valid")return {data:session,error:null}
   if(name==="upt_current_is_owner")return {data:owner,error:null}
   if(name==="upt_god_error_reports")return {data:reports,error:null}
   if(name==="upt_god_repository_connect"||name==="upt_god_repository_disconnect"||
      name==="upt_save_automation_rule"||name==="upt_god_data_mutate"||
      name==="upt_god_error_report_mark_working"||name==="upt_god_error_report_resolve")
    return {data:{saved:true},error:changeError}
   throw Error("unexpected RPC "+name)
  },
  from:table=>{
   assert.equal(table,"automation_rules")
   return {select:()=>({eq:()=>({single:async()=>({data:{
    delay_minutes:4,reminder_minutes:5,escalation_minutes:6,cooldown_minutes:7,
    max_retries:2,channels:["in_app"]
   },error:null})})})}
  }
 }
 return {db,calls}
}
const run=(f,kind,req,cookies=cookie,env=qa)=>
 nativeMakerBusinessResponse(f.db,req,cookies,{SUPABASE_URL:env},kind)
test("all five God Mode write methods require verified private Maker session before any other RPC",async()=>{
 for(const [kind,method,path] of [
  ["automation","POST","/api/god/automation-rules"],
  ["data","POST","/api/god/data"],
  ["report","POST","/api/god/error-reports"],
  ["connect","POST","/api/god/connection"],
  ["disconnect","DELETE","/api/god/connection"]
 ]){
  const req=request(path,method,{})
  const f=fixture()
  assert.equal((await run(f,kind,req,"")).status,401,kind)
  assert.deepEqual(f.calls,[])
  const expired=fixture({session:false})
  assert.equal((await run(expired,kind,req)).status,401)
  assert.deepEqual(expired.calls.map(x=>x.name),["upt_god_session_valid"])
  const wrong=fixture()
  assert.equal((await run(wrong,kind,req,cookie,"https://eakoavcieossazqzplke.supabase.co")).status,503)
  assert.deepEqual(wrong.calls,[])
 }
})
test("cross-origin and cross-site God Mode mutations abort before any database or external HTTP",async()=>{
 for(const [kind,path] of [
  ["automation","/api/god/automation-rules"],
  ["data","/api/god/data"],
  ["report","/api/god/error-reports"],
  ["connect","/api/god/connection"],
  ["disconnect","/api/god/connection"]
 ]){
  for(const h of [{Origin:"https://external.invalid"},{"Sec-Fetch-Site":"cross-site"}]){
   const f=fixture()
   const req=request(path,kind==="disconnect"?"DELETE":"POST",{},h)
   const result=await run(f,kind,req)
   assert.equal(result.status,403,path)
   assert.deepEqual(f.calls,[])
  }
 }
})
test("automation POST retains original defaults, owner RPC, and exact signed SQL procedure",async()=>{
 const f=fixture()
 const res=await run(f,"automation",request("/api/god/automation-rules","POST",{
  automation_key:"crew-reminder",enabled:true,delay_minutes:10
 }))
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{ok:true})
 const rpc=f.calls.find(c=>c.name==="upt_save_automation_rule")
 assert.deepEqual(rpc.args,{p_key:"crew-reminder",p_enabled:true,
  p_delay_minutes:10,p_reminder_minutes:5,p_escalation_minutes:6,
  p_cooldown_minutes:7,p_max_retries:2,p_channels:["in_app"]})
 const denied=fixture({owner:false})
 const r=await run(denied,"automation",request("/api/god/automation-rules","POST",{
  automation_key:"crew-reminder",enabled:true
 }))
 assert.equal(r.status,403)
 assert.ok(!denied.calls.some(x=>x.name==="upt_save_automation_rule"))
})
test("automation mutations reject invalid keys and malformed channels before modifying any rule",async()=>{
 for(const payload of [
  {automation_key:"invalid key",enabled:true},
  {automation_key:"valid",enabled:"yes"},
  {automation_key:"valid",enabled:false,channels:["foreign-channel"]},
  {automation_key:"valid",enabled:true,max_retries:101}
 ]){
  const f=fixture()
  const r=await run(f,"automation",request("/api/god/automation-rules","POST",payload))
  assert.equal(r.status,400)
  assert.ok(!f.calls.some(c=>c.name==="upt_save_automation_rule"))
 }
})
test("God Mode data mutation keeps optimistic concurrency and strict table/key source contract",async()=>{
 const payload={table:"events",operation:"update",key:{id:uuid},
  before:{name:"old"},values:{name:"new"}}
 const f=fixture()
 const res=await run(f,"data",request("/api/god/data","POST",payload))
 assert.equal(res.status,200)
 assert.deepEqual(await res.json(),{saved:true})
 const write=f.calls.find(x=>x.name==="upt_god_data_mutate")
 assert.deepEqual(write.args,{p_token:"signed-maker-token",p_table:"events",
  p_operation:"update",p_key:{id:uuid},p_before:{name:"old"},p_values:{name:"new"}})
 const conflict=fixture({changeError:{message:"Row changed since loaded"}})
 const rejected=await run(conflict,"data",request("/api/god/data","POST",payload))
 assert.equal(rejected.status,409)
 assert.equal((await rejected.json()).error,"Deze rij is intussen gewijzigd. Laad de gegevens opnieuw.")
 const invalid=fixture()
 const wrong=await run(invalid,"data",request("/api/god/data","POST",{...payload,unexpected:"private"}))
 assert.equal(wrong.status,400)
 assert.ok(!invalid.calls.some(x=>x.name==="upt_god_data_mutate"))
})
test("Maker report mark-working mutation uses the exact signed RPC",async()=>{
 const f=fixture()
 const r=await run(f,"report",request("/api/god/error-reports","POST",{
  action:"mark_working",reportId:uuid
 }))
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{ok:true})
 assert.deepEqual(f.calls.find(x=>x.name==="upt_god_error_report_mark_working").args,{
  p_token:"signed-maker-token",p_report:uuid
 })
})
test("Maker report closure requires latest successful Main deploy strictly newer than incident",async()=>{
 const original=globalThis.fetch
 const calls=[]
 globalThis.fetch=async url=>{
  calls.push(String(url))
  return Response.json({workflow_runs:[
   {id:123,head_sha:sha,status:"completed",conclusion:"success",event:"workflow_run",
    created_at:"2026-11-22T12:00:00Z",updated_at:"2026-11-22T12:01:00Z"}
  ]})
 }
 try{
  const f=fixture()
  const payload={action:"resolve",reportId:uuid,note:"De root cause is bevestigd en de flow is opnieuw getest.",sha}
  const r=await run(f,"report",request("/api/god/error-reports","POST",payload))
  assert.equal(r.status,200)
  assert.deepEqual((await r.json()).evidence,{sha,runId:123,environment:"main"})
  const end=f.calls.find(x=>x.name==="upt_god_error_report_resolve")
  assert.equal(end.args.p_report,uuid)
  assert.ok(end.args.p_note.includes("main deployment verified: "+sha))
  assert.equal(calls.length,1)
  assert.ok(calls[0].includes("/actions/workflows/deploy-main.yml/runs?"))
  const stale=fixture({reports:[{id:uuid,status:"new",created_at:"2026-11-23T12:00:00Z"}]})
  const no=await run(stale,"report",request("/api/god/error-reports","POST",payload))
  assert.equal(no.status,409)
  assert.ok(!stale.calls.some(x=>x.name==="upt_god_error_report_resolve"))
 }finally{globalThis.fetch=original}
})
test("GitHub connect validates exact repo push permission and never exposes repository token",async()=>{
 const original=globalThis.fetch;const calls=[]
 globalThis.fetch=async (url,options)=>{
  calls.push({url:String(url),header:options.headers.Authorization})
  return Response.json({full_name:"denkyaan/UpTillDawn-Crew",permissions:{push:true}})
 }
 try{
  const credential="a".repeat(32)
  const f=fixture()
  const r=await run(f,"connect",request("/api/god/connection","POST",{credential}))
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{ok:true})
  assert.deepEqual(calls,[{url:"https://api.github.com/repos/denkyaan/UpTillDawn-Crew",
   header:"Bearer "+credential}])
  assert.equal(f.calls.find(x=>x.name==="upt_god_repository_connect").args.p_secret,credential)
  const disconnected=fixture()
  const result=await run(disconnected,"disconnect",request("/api/god/connection","DELETE"))
  assert.equal(result.status,200)
  assert.deepEqual(disconnected.calls.find(x=>x.name==="upt_god_repository_disconnect").args,
   {p_token:"signed-maker-token"})
 }finally{globalThis.fetch=original}
})
test("wrong GitHub repo or no push permission refuses to store any credential",async()=>{
 const original=globalThis.fetch
 try{
  for(const invalid of [
   {full_name:"example/other",permissions:{push:true}},
   {full_name:"denkyaan/UpTillDawn-Crew",permissions:{push:false}}
  ]){
   globalThis.fetch=async()=>Response.json(invalid)
   const f=fixture()
   const r=await run(f,"connect",request("/api/god/connection","POST",{
    credential:"p".repeat(32)
   }))
   assert.equal(r.status,403)
   assert.deepEqual(await r.json(),{
    error:"Deze sleutel heeft geen schrijftoegang tot UpTillDawn-Crew."
   })
   assert.ok(!f.calls.some(c=>c.name==="upt_god_repository_connect"))
  }
 }finally{globalThis.fetch=original}
})
test("all seven candidate write methods are blocked before authentication or legacy proxy on public QA",async()=>{
 let oldWorker=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{oldWorker++;throw Error("legacy Next Worker invoked")}}
 }
 for(const [path,method] of [
  ["/api/god/automation-rules","POST"],["/api/god/data","POST"],
  ["/api/god/error-reports","POST"],["/api/god/connection","POST"],
  ["/api/god/connection","DELETE"],["/api/administration/integrations","POST"],
  ["/api/administration/integrations","DELETE"]
 ]){
  const res=await app.request(origin+path,{
   method,headers:{"Content-Type":"application/json",Origin:origin},body:"{}"
  },env)
  assert.equal(res.status,503,method+" "+path)
  assert.deepEqual(await res.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(oldWorker,0)
})
