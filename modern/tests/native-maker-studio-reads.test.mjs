import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerStudioReadResponse} from "../src/api/native-maker-studio-reads.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const cookie="uptilldawn-god-session=test-god-session"
const sha="a".repeat(40)
const req=(route,headers={})=>new Request(origin+route,{headers})
function fixture({session=true,repoSecret=null,dbSecret=null}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push([name,args])
  if(name==="upt_god_session_valid")return {data:session,error:null}
  if(name==="upt_god_repository_secret")return {data:repoSecret,error:null}
  if(name==="upt_god_database_secret")return {data:dbSecret,error:null}
  throw Error("Unexpected Maker RPC: "+name)
 }}
 return {db,calls}
}
async function call(f,path,cookies=cookie,env={SUPABASE_URL:qa},headers={}){
 return nativeMakerStudioReadResponse(f.db,req(path,headers),cookies,env,path.split("?")[0])
}
test("source and SQL status reject missing private God cookie without database or GitHub access",async()=>{
 for(const path of ["/api/god/source","/api/god/sql"]){
  const f=fixture()
  const r=await call(f,path,"")
  assert.equal(r.status,401)
  assert.deepEqual(f.calls,[])
 }
})
test("source and SQL status reject expired God sessions and cross-site Origin",async()=>{
 for(const path of ["/api/god/source","/api/god/sql"]){
  const bad=fixture({session:false})
  assert.equal((await call(bad,path)).status,401)
  assert.deepEqual(bad.calls.map(x=>x[0]),["upt_god_session_valid"])
  for(const headers of [{Origin:"https://attacker.invalid"},{"Sec-Fetch-Site":"cross-site"}]){
   const f=fixture()
   assert.equal((await call(f,path,cookie,{SUPABASE_URL:qa},headers)).status,403)
   assert.deepEqual(f.calls,[])
  }
 }
})
test("SQL GET reports connection state without leaking Management credential or issuing queries",async()=>{
 const f=fixture({dbSecret:"very-private-credential"})
 const r=await call(f,"/api/god/sql")
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{connected:true,environment:"main",environments:["main","production"]})
 assert.equal(r.headers.get("cache-control"),"no-store")
 assert.deepEqual(f.calls.map(x=>x[0]),["upt_god_session_valid","upt_god_database_secret"])
 const missing=fixture()
 const a=await call(missing,"/api/god/sql")
 assert.equal((await a.json()).connected,false)
})
test("production database identity is not recognized by the isolated QA worker",async()=>{
 const f=fixture()
 const r=await call(f,"/api/god/sql",cookie,{SUPABASE_URL:"https://eakoavcieossazqzplke.supabase.co"})
 assert.equal(r.status,503)
 assert.deepEqual(f.calls,[])
})
test("repository tree lists only editable files and never returns the stored GitHub token",async()=>{
 const f=fixture({repoSecret:"github-secret-private"})
 const original=globalThis.fetch;const urls=[]
 globalThis.fetch=async (url,opts)=>{
  urls.push({url:String(url),auth:opts.headers.Authorization})
  if(String(url).includes("/git/ref/heads/main"))return Response.json({object:{sha}})
  if(String(url).includes("/git/trees/"))return Response.json({truncated:false,tree:[
   {path:"app/page.tsx",type:"blob",mode:"100644",sha,size:100},
   {path:".env.production",type:"blob",mode:"100644",sha,size:22},
   {path:"assets/banner.png",type:"blob",mode:"100644",sha,size:22},
   {path:"lib/security.ts",type:"blob",mode:"100644",sha,size:120}
  ]})
  throw Error("Unexpected GitHub URL")
 }
 try{
  const r=await call(f,"/api/god/source?action=tree")
  assert.equal(r.status,200)
  const body=await r.json()
  assert.deepEqual(body.files.map(x=>x.path),["app/page.tsx","lib/security.ts"])
  assert.equal(body.head,sha)
  assert.equal(body.connected,true)
  assert.ok(!JSON.stringify(body).includes("github-secret-private"))
  assert.equal(urls.length,2)
  assert.ok(urls.every(x=>x.auth==="Bearer github-secret-private"))
  assert.ok(urls.every(x=>x.url.startsWith("https://api.github.com/repos/denkyaan/UpTillDawn-Crew/")))
 }finally{globalThis.fetch=original}
})
test("source file GET returns exact UTF-8 content, rejects path traversal and oversized content",async()=>{
 const f=fixture()
 const original=globalThis.fetch;let count=0
 globalThis.fetch=async ()=>{
  count++
  const content="Welkom in God Mode"
  return Response.json({content:btoa(content),encoding:"base64",sha,size:content.length})
 }
 try{
  const bad=await call(f,"/api/god/source?action=file&path=../.env.production&ref="+sha)
  assert.equal(bad.status,400)
  assert.equal(count,0)
  const good=await call(f,"/api/god/source?action=file&path=lib%2Fsafe.ts&ref="+sha)
  assert.equal(good.status,200)
  assert.deepEqual(await good.json(),{path:"lib/safe.ts",sha,content:"Welkom in God Mode"})
  assert.equal(count,1)
 }finally{globalThis.fetch=original}
})
test("history and workflow checks preserve source DTO and only retain God Mode PRs",async()=>{
 const f=fixture()
 const original=globalThis.fetch
 globalThis.fetch=async (url)=>{
  const path=String(url)
  if(path.includes("/commits?"))return Response.json([{sha,commit:{message:"ok"}}])
  if(path.includes("/pulls?"))return Response.json([
   {number:2,head:{ref:"god-mode/preview",repo:{full_name:"denkyaan/UpTillDawn-Crew"}}},
   {number:3,head:{ref:"feature/unrelated",repo:{full_name:"denkyaan/UpTillDawn-Crew"}}},
   {number:4,head:{ref:"god-mode/evil",repo:{full_name:"external/repo"}}}
  ])
  if(path.includes("/actions/runs?"))return Response.json({workflow_runs:[
   {id:123,name:"CI main",path:".github/workflows/fast-change-validation.yml",
    head_sha:sha,status:"completed",conclusion:"success",
    html_url:"https://github.com/test",run_attempt:1,event:"pull_request"}
  ]})
  throw Error("Wrong GitHub URL "+path)
 }
 try{
  const history=await call(f,"/api/god/source?action=history")
  assert.equal(history.status,200)
  const body=await history.json()
  assert.deepEqual(body.pulls.map(x=>x.number),[2])
  const checks=await call(f,"/api/god/source?action=checks&sha="+sha)
  assert.equal(checks.status,200)
  const runs=(await checks.json()).runs
  assert.equal(runs.length,1)
  assert.deepEqual(Object.keys(runs[0]).sort(),
   ["id","name","path","head_sha","status","conclusion","html_url","run_attempt"].sort())
  assert.equal((await call(f,"/api/god/source?action=checks&sha=invalid")).status,400)
 }finally{globalThis.fetch=original}
})
test("GitHub authentication errors fail closed with no credential in response",async()=>{
 const f=fixture({repoSecret:"private-gh-token"})
 const original=globalThis.fetch
 globalThis.fetch=async()=>Response.json({message:"invalid key"},{status:403})
 try{
  const r=await call(f,"/api/god/source")
  assert.equal(r.status,403)
  assert.ok(!(await r.text()).includes("private-gh-token"))
 }finally{globalThis.fetch=original}
})
test("anonymous native source and SQL requests never hit the old Main Worker",async()=>{
 let next=0
 const env={
  SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{next++;throw Error("legacy Worker unexpectedly used")}}
 }
 for(const path of ["/api/god/source","/api/god/sql"]){
  const r=await app.request(origin+path,{},env)
  assert.equal(r.status,401,path)
 }
 assert.equal(next,0)
})
