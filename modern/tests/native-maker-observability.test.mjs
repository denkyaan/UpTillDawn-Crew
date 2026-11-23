import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {makerObservabilityResponse} from "../src/api/native-maker-observability.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const env={SUPABASE_URL:qa}
const cookie="uptilldawn-god-session=maker-qa-token"
function request(path,headers={}){return new Request(origin+path,{headers})}
function fixture({session=true,secret=null}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push([name,args])
  if(name==="upt_god_session_valid")return {data:session,error:null}
  if(name==="upt_god_maker_log_snapshot")return {data:{errors:[],recovery:[],audit:[]},error:null}
  if(name==="upt_god_database_secret")return {data:secret,error:null}
  throw Error("Unapproved Maker RPC: "+name)
 }}
 return {db,calls}
}
test("all three original observability routes require the expiring private God cookie",async()=>{
 for(const path of ["/api/god/logs","/api/god/platform-logs?environment=main",
  "/api/god/cloudflare-logs?environment=main"]){
  const f=fixture()
  const r=await makerObservabilityResponse(f.db,request(path),"",env,path.split("?")[0])
  assert.equal(r.status,401,path)
  assert.deepEqual(f.calls,[])
  const bad=fixture({session:false})
  const denied=await makerObservabilityResponse(bad.db,request(path),cookie,env,path.split("?")[0])
  assert.equal(denied.status,401)
  assert.deepEqual(bad.calls,[["upt_god_session_valid",{p_token:"maker-qa-token"}]])
 }
})
test("cross-origin Maker requests are rejected before any RPC or provider call",async()=>{
 for(const [name,headers] of [
  ["origin",{Origin:"https://attacker.invalid"}],
  ["fetch-site",{"Sec-Fetch-Site":"cross-site"}]
 ]){
  const f=fixture()
  const result=await makerObservabilityResponse(f.db,request("/api/god/logs",headers),cookie,env,"/api/god/logs")
  assert.equal(result.status,403,name)
  assert.deepEqual(f.calls,[])
 }
})
test("Main native Maker logs preserve the original snapshot, source and bounded limit",async()=>{
 const f=fixture()
 const result=await makerObservabilityResponse(f.db,request("/api/god/logs?limit=17"),
  cookie,env,"/api/god/logs")
 assert.equal(result.status,200)
 assert.deepEqual(await result.json(),{logs:{errors:[],recovery:[],audit:[]},
  environment:"main",source:"authenticated environment"})
 assert.equal(result.headers.get("cache-control"),"no-store")
 assert.deepEqual(f.calls,[
  ["upt_god_session_valid",{p_token:"maker-qa-token"}],
  ["upt_god_maker_log_snapshot",{p_token:"maker-qa-token",p_limit:17}]
 ])
})
test("production Maker diagnostics need the independent Management credential",async()=>{
 const f=fixture()
 const r=await makerObservabilityResponse(f.db,
  request("/api/god/logs?environment=production"),cookie,env,"/api/god/logs")
 assert.equal(r.status,428)
 assert.deepEqual(f.calls.map(c=>c[0]),["upt_god_session_valid","upt_god_database_secret"])
 const p=fixture()
 const platform=await makerObservabilityResponse(p.db,
  request("/api/god/platform-logs?environment=production"),cookie,env,"/api/god/platform-logs")
 assert.equal(platform.status,428)
 assert.deepEqual(p.calls.map(c=>c[0]),["upt_god_session_valid","upt_god_database_secret"])
})
test("invalid limits, environments and Cloudflare parameters are rejected without upstream calls",async()=>{
 for(const [path,expected] of [
  ["/api/god/logs?limit=101","/api/god/logs"],
  ["/api/god/logs?environment=other","/api/god/logs"],
  ["/api/god/platform-logs?environment=main&limit=999","/api/god/platform-logs"],
  ["/api/god/cloudflare-logs?environment=production&minutes=61","/api/god/cloudflare-logs"],
  ["/api/god/cloudflare-logs?environment=main&token=leak","/api/god/cloudflare-logs"]
 ]){
  const f=fixture()
  const result=await makerObservabilityResponse(f.db,request(path),cookie,env,expected)
  assert.equal(result.status,400,path)
  assert.equal(f.calls.length,1)
 }
})
test("Cloudflare is not queried without a separately configured Observability token",async()=>{
 const f=fixture()
 const res=await makerObservabilityResponse(f.db,
  request("/api/god/cloudflare-logs?environment=main"),cookie,env,"/api/god/cloudflare-logs")
 assert.equal(res.status,428)
 assert.deepEqual(f.calls.map(c=>c[0]),["upt_god_session_valid"])
})
test("Cloudflare results are double-filtered to the exact requested Worker name",async()=>{
 const f=fixture()
 const originalFetch=globalThis.fetch
 const calls=[]
 globalThis.fetch=async (url,options)=>{
  calls.push({url:String(url),headers:options.headers,body:JSON.parse(options.body)})
  return Response.json({success:true,result:{events:{events:[
   {timestamp:1730000000000,$metadata:{service:"uptilldawn-main",message:"safe"}},
   {timestamp:1730000000000,$metadata:{service:"other-app",message:"different customer"}},
   {timestamp:1730000000000,$metadata:{service:"uptilldawn-crew",message:"production secret"}}
  ]}}})
 }
 try{
  const res=await makerObservabilityResponse(f.db,request("/api/god/cloudflare-logs?environment=main"),
   cookie,{...env,CLOUDFLARE_OBSERVABILITY_CONFIG:JSON.stringify({accountId:"a".repeat(32),token:"b".repeat(24)})},
   "/api/god/cloudflare-logs")
  assert.equal(res.status,200)
  const body=await res.json()
  assert.equal(body.logs.length,1)
  assert.equal(body.logs[0].message,"safe")
  assert.equal(calls.length,1)
  assert.ok(calls[0].url.startsWith("https://api.cloudflare.com/client/v4/accounts/"))
  assert.equal(calls[0].body.parameters.filters[0].value,"uptilldawn-main")
 }finally{globalThis.fetch=originalFetch}
})
test("Main-QA Worker anonymous GETs for the three native routes never proxy to Next",async()=>{
 let sourceCalls=0
 const workerEnv={
  SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{sourceCalls++;throw Error("LEGACY_PROXY_NOT_ALLOWED")}}
 }
 for(const path of ["/api/god/logs","/api/god/platform-logs","/api/god/cloudflare-logs"]){
  const r=await app.request(origin+path,{},workerEnv)
  assert.equal(r.status,401,path)
 }
 assert.equal(sourceCalls,0)
})
