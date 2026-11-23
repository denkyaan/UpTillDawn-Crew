import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerSourcePost} from "../src/api/native-maker-source-post.ts"
import {nativeMakerSqlPost} from "../src/api/native-maker-sql-post.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const god="uptilldawn-god-session=private-owner-session"
const a="a".repeat(40),b="b".repeat(40),c="c".repeat(40)
const request=(path,body,headers={})=>new Request(origin+path,{
 method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
 body:JSON.stringify(body)
})
function fixture({session=true,secret="private-credential",databaseSecret="db-management-credential"}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==="upt_god_session_valid")return {data:session,error:null}
  if(name==="upt_god_repository_secret")return {data:secret,error:null}
  if(name==="upt_god_database_secret")return {data:databaseSecret,error:null}
  if(["upt_god_database_connect","upt_god_database_disconnect"].includes(name))
   return {data:true,error:null}
  throw Error("Unexpected RPC: "+name)
 }}
 return {db,calls}
}
const source=(f,body,cookies=god,env={SUPABASE_URL:qa},headers={})=>
 nativeMakerSourcePost(f.db,request("/api/god/source",body,headers),cookies,env)
const sql=(f,body,cookies=god,env={SUPABASE_URL:qa},headers={})=>
 nativeMakerSqlPost(f.db,request("/api/god/sql",body,headers),cookies,env)
test("Maker source & SQL mutations deny unauthenticated, expired, cross-site and production identities before HTTP",async()=>{
 for(const kind of ["source","sql"]){
  const run=kind==="source"?source:sql
  const f=fixture()
  assert.equal((await run(f,{action:"disconnect"},"")).status,401)
  assert.equal(f.calls.length,0)
  const expired=fixture({session:false})
  assert.equal((await run(expired,{action:"disconnect"})).status,401)
  assert.deepEqual(expired.calls.map(x=>x.name),["upt_god_session_valid"])
  const cross=fixture()
  assert.equal((await run(cross,{action:"disconnect"},god,{SUPABASE_URL:qa},{Origin:"https://external.invalid"})).status,403)
  assert.deepEqual(cross.calls,[])
  const prod=fixture()
  assert.equal((await run(prod,{action:"disconnect"},god,{SUPABASE_URL:"https://eakoavcieossazqzplke.supabase.co"})).status,503)
  assert.deepEqual(prod.calls,[])
 }
})
test("SQL read-only Production management query is explicit and never includes session cookie",async()=>{
 const f=fixture()
 const old=globalThis.fetch;const seen=[]
 globalThis.fetch=async (url,opts)=>{
  seen.push({url:String(url),headers:opts.headers,body:JSON.parse(opts.body)})
  return Response.json([{database:"postgres"}])
 }
 try{
  const r=await sql(f,{action:"query",query:"select 1",write:false,environment:"production"})
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{environment:"production",data:[{database:"postgres"}]})
  assert.equal(seen.length,1)
  assert.equal(seen[0].url,"https://api.supabase.com/v1/projects/eakoavcieossazqzplke/database/query")
  assert.equal(seen[0].body.read_only,true)
  assert.equal(seen[0].headers.Authorization,"Bearer db-management-credential")
  assert.ok(!JSON.stringify(seen).includes("private-owner-session"))
 }finally{globalThis.fetch=old}
})
test("SQL can never write to production from QA and requires separate explicit local opt-in",async()=>{
 const f=fixture()
 const old=globalThis.fetch;let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true})}
 try{
  const production=await sql(f,{action:"query",query:"delete from profiles",write:true,environment:"production"})
  assert.equal(production.status,403)
  assert.equal(calls,0)
  const main=await sql(f,{action:"query",query:"select 1",write:true})
  assert.equal(main.status,403)
  assert.equal(calls,0)
  const enabled=await sql(f,{action:"query",query:"select 1",write:true},god,{
   SUPABASE_URL:qa,UPT_MIGRATION_SQL_WRITES_ENABLED:"true"
  })
  assert.equal(enabled.status,200)
  assert.equal(calls,1)
 }finally{globalThis.fetch=old}
})
test("SQL connect probes its real QA project read-only before storing management secret",async()=>{
 const f=fixture()
 const old=globalThis.fetch;const urls=[]
 globalThis.fetch=async (url,opts)=>{
  urls.push({url:String(url),read_only:JSON.parse(opts.body).read_only})
  return Response.json([{database:"postgres"}])
 }
 try{
  const r=await sql(f,{action:"connect",credential:"x".repeat(32)})
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{ok:true,environment:"main"})
  assert.ok(urls[0].url.endsWith("/npbjrtiolqperdgljnhi/database/query"))
  assert.equal(urls[0].read_only,true)
  assert.equal(f.calls.find(x=>x.name==="upt_god_database_connect").args.p_secret,"x".repeat(32))
  const disconnected=fixture()
  assert.equal((await sql(disconnected,{action:"disconnect"})).status,200)
  assert.ok(disconnected.calls.some(x=>x.name==="upt_god_database_disconnect"))
 }finally{globalThis.fetch=old}
})
test("GitHub source input validation rejects unsafe paths, duplicate changes and oversized batches without GitHub writes",async()=>{
 const f=fixture()
 const old=globalThis.fetch;let external=0
 globalThis.fetch=async()=>{external++;throw Error("Unexpected GitHub call")}
 try{
  for(const body of [
   {action:"save",base:a,title:"Valid title",changes:[
    {path:"../.env.production",content:"private"}]},
   {action:"save",base:a,title:"Valid title",changes:[
    {path:"app/page.tsx",content:"test"},{path:"app/page.tsx",content:"test2"}]},
   {action:"save",base:a,title:"Valid title",changes:[
    {path:"app/page.tsx",content:"x".repeat(500_001)}]},
   {action:"publish",number:0,sha:a}
  ]){
   const r=await source(f,body)
   assert.equal(r.status,400)
  }
  assert.equal(external,0)
 }finally{globalThis.fetch=old}
})
test("source save uses exact main base, preserves executable file mode and creates review-only God Mode PR",async()=>{
 const f=fixture();const old=globalThis.fetch;const seen=[]
 globalThis.fetch=async(url,opts)=>{
  const name=String(url),payload=opts.body?JSON.parse(opts.body):null
  seen.push({name,method:opts.method||"GET",payload})
  if(name.endsWith("/git/ref/heads/main"))return Response.json({object:{sha:a}})
  if(name.endsWith("/git/commits/"+a))return Response.json({sha:a,tree:{sha:b}})
  if(name.includes("/git/trees/"+a))return Response.json({truncated:false,tree:[
   {path:"scripts/run.mjs",type:"blob",mode:"100755",sha:c}
  ]})
  if(name.endsWith("/git/trees")&&opts.method==="POST")return Response.json({sha:b})
  if(name.endsWith("/git/commits")&&opts.method==="POST")return Response.json({sha:c})
  if(name.endsWith("/git/refs")&&opts.method==="POST")return Response.json({ref:payload.ref})
  if(name.endsWith("/pulls")&&opts.method==="POST")return Response.json({number:449,html_url:"https://github.com/test/pull/449"})
  throw Error("Unexpected Github call "+name)
 }
 try{
  const r=await source(f,{action:"save",base:a,title:"Test source modification",changes:[
   {path:"scripts/run.mjs",content:"#!/bin/sh\necho success\n"}
  ]})
  assert.equal(r.status,200)
  const result=await r.json()
  assert.equal(result.ok,true)
  assert.match(result.proposal.branch,/^god-mode\/[0-9]+-[a-f0-9-]+$/)
  assert.equal(result.proposal.number,449)
  const tree=seen.find(x=>x.name.endsWith("/git/trees")&&x.method==="POST")
  assert.deepEqual(tree.payload.tree,[{
   path:"scripts/run.mjs",mode:"100755",type:"blob",content:"#!/bin/sh\necho success\n"
  }])
  assert.ok(seen.every(x=>x.name.startsWith("https://api.github.com/repos/denkyaan/UpTillDawn-Crew/")))
  assert.ok(seen.every(x=>x.name.includes("production")===false))
 }finally{globalThis.fetch=old}
})
test("source proposal refuses a stale Main SHA before it can create a commit",async()=>{
 const f=fixture();const old=globalThis.fetch;const seen=[]
 globalThis.fetch=async url=>{
  seen.push(String(url))
  return Response.json({object:{sha:b}})
 }
 try{
  const r=await source(f,{action:"save",base:a,title:"Valid title",
   changes:[{path:"app/page.tsx",content:"fresh"}]})
  assert.equal(r.status,409)
  assert.equal(seen.length,1)
 }finally{globalThis.fetch=old}
})
test("source publishing refuses unapproved or mismatched PR and can never merge into Production",async()=>{
 const f=fixture();const old=globalThis.fetch;const seen=[]
 globalThis.fetch=async(url,opts)=>{
  const name=String(url);seen.push({name,method:opts.method||"GET"})
  if(name.endsWith("/pulls/449"))return Response.json({
   number:449,state:"open",head:{ref:"god-mode/preview",sha:a,repo:{full_name:"denkyaan/UpTillDawn-Crew"}},
   base:{ref:"main"}
  })
  if(name.includes("/fast-change-validation.yml/runs"))
   return Response.json({workflow_runs:[]})
  throw Error("Unexpected request "+name)
 }
 try{
  const r=await source(f,{action:"publish",number:449,sha:a})
  assert.equal(r.status,409)
  assert.ok(!seen.some(x=>x.method==="PUT"))
  assert.ok(!seen.some(x=>x.name.includes("production")))
 }finally{globalThis.fetch=old}
})
test("every source & SQL POST is denied before authentication or legacy Next worker on deployed QA",async()=>{
 let proxy=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",UPT_MIGRATION_SQL_WRITES_ENABLED:"false",
  MAIN_AUTH:{fetch:async()=>{proxy++;throw Error("legacy Next unexpectedly used")}}
 }
 for(const path of ["/api/god/source","/api/god/sql"]){
  const r=await app.request(origin+path,{
   method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:"{}"
  },env)
  assert.equal(r.status,503)
  assert.deepEqual(await r.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(proxy,0)
})
