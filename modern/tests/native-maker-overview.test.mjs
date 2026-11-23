import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerStudioReadResponse} from "../src/api/native-maker-studio-reads.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const cookie="uptilldawn-god-session=owner-session"
const head="a".repeat(40),before="b".repeat(40)
function request(path,headers={}){return new Request(origin+path,{headers})}
function fixture({session=true,ghKey=null,dbKey=null,reportError=null}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push([name,args])
  if(name==="upt_god_session_valid")return {data:session,error:null}
  if(name==="upt_god_repository_secret")return {data:ghKey,error:null}
  if(name==="upt_god_database_secret")return {data:dbKey,error:null}
  if(name==="upt_god_error_reports")return {data:[
   {status:"resolved"},{status:"new"},{status:"needs_maker",maker_action_required:true},
   {status:"failed",maker_action_required:false}
  ],error:reportError}
  throw Error("Unexpected Maker overview RPC "+name)
 }}
 return {db,calls}
}
function get(f,path="/api/god/overview",headers={}){
 return nativeMakerStudioReadResponse(f.db,request(path,headers),cookie,{SUPABASE_URL:qa},"/api/god/overview")
}
function fakeGithubCalls(){
 const seen=[]
 const make=(event,workflow,sha,id,status="completed",conclusion="success")=>({
  id, name:workflow, event,head_sha:sha,head_branch:"main",
  status,conclusion,html_url:"https://github.com/denkyaan/UpTillDawn-Crew/actions/runs/"+id,
  created_at:"2026-11-23T17:00:00Z"
 })
 const fake=async (url,options)=>{
  const path=String(url);seen.push({path,headers:options?.headers,body:options?.body})
  if(path.includes("/git/ref/heads/main"))return Response.json({object:{sha:head}})
  if(path.includes("/actions/workflows/fast-change-validation.yml/"))
   return Response.json({workflow_runs:[
    make("pull_request","CI main",before,600),make("push","CI main",head,500),
    make("push","CI main",before,400)
   ]})
  if(path.includes("/actions/workflows/deploy-main.yml/"))
   return Response.json({workflow_runs:[make("workflow_run","Deploy main",head,900)]})
  if(path.includes("/actions/workflows/ci.yml/"))
   return Response.json({workflow_runs:[make("workflow_dispatch","CI production",before,800)]})
  if(path.includes("/actions/workflows/deploy-cloudflare.yml/"))
   return Response.json({workflow_runs:[make("workflow_dispatch","Deploy production",before,700)]})
  if(path.includes("api.supabase.com")){
   const b=JSON.parse(options.body)
   assert.equal(b.read_only,true)
   if(b.query.includes("information_schema.columns"))return Response.json([{tab:"admin_financial_documents",col:"id"}])
   return Response.json([{checked:8,open:3,needs_maker:1,failed:1}])
  }
  throw Error("Unknown external source "+path)
 }
 return {seen,fake}
}
test("Maker overview GET rejects expired, missing and cross-origin God session before external calls",async()=>{
 const r=fixture()
 const missing=await nativeMakerStudioReadResponse(r.db,request("/api/god/overview"),"",{SUPABASE_URL:qa},"/api/god/overview")
 assert.equal(missing.status,401)
 assert.deepEqual(r.calls,[])
 const expired=fixture({session:false})
 assert.equal((await get(expired)).status,401)
 assert.deepEqual(expired.calls.map(x=>x[0]),["upt_god_session_valid"])
 const x=fixture()
 assert.equal((await get(x,"/api/god/overview",{Origin:"https://outside.invalid"})).status,403)
 assert.deepEqual(x.calls,[])
})
test("Main native overview correctly identifies current deployed SHA and counts Maker errors",async()=>{
 const f=fixture({ghKey:"private-gh-key",dbKey:"private-db-key"})
 const {seen,fake}=fakeGithubCalls()
 const original=globalThis.fetch;globalThis.fetch=fake
 try{
  const r=await get(f)
  assert.equal(r.status,200)
  const body=await r.json()
  assert.equal(body.repository,"denkyaan/UpTillDawn-Crew")
  assert.equal(body.environment,"main")
  assert.equal(body.head,head)
  assert.equal(body.mainHead,head)
  assert.equal(body.deployedSha,head)
  assert.equal(body.ci.current,true)
  assert.equal(body.deploy.current,true)
  assert.deepEqual(body.reports,{checked:4,open:3,needsMaker:1,failed:1})
  assert.deepEqual(body.checks,{code:true,ci:true,deploy:true,reports:true})
  assert.equal(body.githubConnected,true)
  assert.equal(body.databaseConnected,true)
  assert.ok(!JSON.stringify(body).includes("private-gh-key"))
  assert.ok(!JSON.stringify(body).includes("private-db-key"))
  assert.ok(seen.every(x=>!x.path.includes("api.supabase.com")))
  assert.ok(seen.every(x=>x.headers.Authorization==="Bearer private-gh-key"))
 }finally{globalThis.fetch=original}
})
test("Production overview only performs explicitly read-only management requests and cannot claim deployed release",async()=>{
 const f=fixture({ghKey:"private-gh-key",dbKey:"private-db-key"})
 const {seen,fake}=fakeGithubCalls(),original=globalThis.fetch
 globalThis.fetch=fake
 try{
  const r=await get(f,"/api/god/overview?environment=production")
  assert.equal(r.status,200)
  const body=await r.json()
  assert.equal(body.environment,"production")
  assert.equal(body.deployedSha,null)
  assert.equal(body.productionReleaseShaVerified,false)
  assert.equal(body.head,before)
  assert.deepEqual(body.productionSchema,{
   ready:false,missing:["admin_financial_documents:id"],checked:18
  })
  assert.deepEqual(body.reports,{checked:8,open:3,needsMaker:1,failed:1})
  const management=seen.filter(x=>x.path.startsWith("https://api.supabase.com"))
  assert.equal(management.length,2)
  assert.ok(management.every(x=>x.path.includes("/projects/eakoavcieossazqzplke/database/query")))
  assert.ok(management.every(x=>x.headers.Authorization==="Bearer private-db-key"))
  assert.ok(!JSON.stringify(body).includes("private-db-key"))
 }finally{globalThis.fetch=original}
})
test("Unconfigured Production connection must never request Supabase production data",async()=>{
 const f=fixture()
 const {seen,fake}=fakeGithubCalls(),original=globalThis.fetch;globalThis.fetch=fake
 try{
  const r=await get(f,"/api/god/overview?environment=production")
  assert.equal(r.status,200)
  const body=await r.json()
  assert.equal(body.databaseConnected,false)
  assert.equal(body.productionSchema,null)
  assert.equal(body.reports,null)
  assert.equal(body.productionReleaseShaVerified,false)
  assert.ok(seen.every(x=>!x.path.startsWith("https://api.supabase.com")))
 }finally{globalThis.fetch=original}
})
test("Anonymous Hono overview never forwards to legacy Main",async()=>{
 let proxied=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{proxied++;return Response.json({secret:"no"})}}}
 const r=await app.request(origin+"/api/god/overview",{},env)
 assert.equal(r.status,401)
 assert.equal(proxied,0)
})
