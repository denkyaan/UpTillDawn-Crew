import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerTextExecution} from "../src/api/native-maker-text-execution.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const SHA="a".repeat(40)
const token="uptilldawn-god-session=short-lived-private-token"
const file="app/(app)/admin/page.tsx"
const OTHER="app/layout.tsx"
const MIGRATION="supabase/migrations/20261101120000_initial.sql"
const requests=(body,headers={})=>new Request(origin+"/api/god/text-execution",{
 method:"POST",headers:{"Content-Type":"application/json",Origin:origin,...headers},
 body:JSON.stringify(body)
})
const makeDb=({valid=true,credential="secure-github-token",markError=null}={})=>{
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==="upt_god_session_valid")return {data:valid,error:null}
  if(name==="upt_god_repository_secret")return {data:credential,error:null}
  if(name==="upt_god_error_report_mark_working")return {data:true,error:markError}
  throw Error("Unexpected RPC "+name)
 }}
 return {db,calls}
}
const index=[{file,line:8,kind:"functie",label:"Admin",handler:"Page"}]
const toBase64=text=>Buffer.from(text,"utf8").toString("base64")
const githubFile=text=>({content:toBase64(text),encoding:"base64",
 size:Buffer.byteLength(text)})
function network({tree=[file,OTHER,MIGRATION],indexValue=index}={}){
 const seen=[]
 const original=globalThis.fetch
 globalThis.fetch=async(url,init)=>{
  const u=String(url);seen.push({url:u,authorization:init?.headers?.Authorization})
  assert.ok(u.startsWith("https://api.github.com/repos/denkyaan/UpTillDawn-Crew/"))
  if(u.endsWith("/git/ref/heads/main"))return Response.json({object:{sha:SHA}})
  if(u.includes("/git/trees/"+SHA+"?recursive=1"))
   return Response.json({truncated:false,tree:tree.map(path=>({path,type:"blob"}))})
  if(u.includes("/contents/lib/god-source-index.json?ref="+SHA))
   return Response.json(githubFile(JSON.stringify(indexValue)))
  if(u.includes("/contents/"+file.split("/").map(encodeURIComponent).join("/")+"?ref="+SHA))
   return Response.json(githubFile("export default function Page(){return null}"))
  if(u.includes("/contents/"+MIGRATION+"?ref="+SHA))
   return Response.json(githubFile("-- approved original sql"))
  if(u.includes("/contents/"+OTHER+"?ref="+SHA))
   return Response.json(githubFile("export const metadata={}"))
  throw Error("Unexpected source GET "+u)
 }
 return {seen,restore:()=>{globalThis.fetch=original}}
}
function aiEngine({changes=[{path:file,content:"export default function Page(){return 'new'}"}],
 selected=[file],seen=[]}={}){
 return {run:async(_,input)=>{
  seen.push(input)
  if(seen.length%2===1)return {response:JSON.stringify({
   answer:"Select relevant Admin source",paths:selected
  })}
  return {response:JSON.stringify({title:"Reviewable admin source update",
   answer:"Concept, nog niet gepubliceerd.",changes})}
 }}
}
const call=(fixture,body,ai,cookie=token,env={SUPABASE_URL:qa},headers={})=>
 nativeMakerTextExecution(fixture.db,requests(body,headers),cookie,env,ai)
test("natural-language Maker proposal requires signed QA private session and rejects cross-site",async()=>{
 const none=makeDb(),noSession=await call(none,{message:"Admin layout"},aiEngine(),"")
 assert.equal(noSession.status,401)
 assert.equal(none.calls.length,0)
 const expired=makeDb({valid:false})
 assert.equal((await call(expired,{message:"Admin layout"},aiEngine())).status,401)
 assert.deepEqual(expired.calls.map(x=>x.name),["upt_god_session_valid"])
 const off=makeDb()
 assert.equal((await call(off,{message:"Admin layout"},aiEngine(),token,
  {SUPABASE_URL:"https://eakoavcieossazqzplke.supabase.co"})).status,503)
 assert.equal(off.calls.length,0)
 const cross=makeDb()
 assert.equal((await call(cross,{message:"Admin layout"},aiEngine(),token,{SUPABASE_URL:qa},
  {Origin:"https://outside.invalid"})).status,403)
 assert.equal(cross.calls.length,0)
})
test("Maker natural text generates only a reviewable source proposal for exactly pinned Main SHA",async()=>{
 const f=makeDb(),n=network(),calls=[]
 const changes=[{path:file,content:"export default function Page(){return 'new'}"},
  {path:"docs/ai-review.md",content:"Changes to consider"}]
 try{
  const response=await call(f,{message:"Wijzig Admin layout"},aiEngine({changes,seen:calls}))
  assert.equal(response.status,200)
  const result=await response.json()
  assert.deepEqual(result,{base:SHA,title:"Reviewable admin source update",
   answer:"Concept, nog niet gepubliceerd.",changes,selectedFiles:[file],
   sourceSelection:"Select relevant Admin source"})
  assert.equal(calls.length,2)
  assert.ok(n.seen.every(item=>item.authorization==="Bearer secure-github-token"))
  assert.ok(n.seen.every(item=>!item.url.includes("production")))
  assert.ok(!f.calls.some(x=>x.name.includes("publish")))
  assert.deepEqual(f.calls.map(x=>x.name),[
   "upt_god_session_valid","upt_god_repository_secret"
  ])
 }finally{n.restore()}
})
test("unreviewed existing file and historical SQL migration proposals are rejected before touching error reports",async()=>{
 const payload={message:"Wijzig Admin UI",errorReportId:"33333333-3333-4333-8333-333333333333"}
 for(const changes of [
  [{path:OTHER,content:"export const metadata={title:'changed'}"}],
  [{path:MIGRATION,content:"-- altered historical SQL"}],
  [{path:"docs/not-seen.md",content:null}],
  [{path:"docs/duplicate.md",content:"first"},{path:"docs/duplicate.md",content:"second"}],
  [{path:"supabase/migrations/20000101000000_bad.sql",content:"select 1"}]
 ]){
  const f=makeDb(),n=network()
  try{
   const response=await call(f,payload,aiEngine({changes}))
   assert.equal(response.status,409,JSON.stringify(changes))
   assert.ok(!f.calls.some(x=>x.name==="upt_god_error_report_mark_working"))
  }finally{n.restore()}
 }
})
test("valid error report marking occurs only AFTER source and model have been safely validated",async()=>{
 const f=makeDb(),n=network(),id="33333333-3333-4333-8333-333333333333"
 try{
  const r=await call(f,{message:"Fix Admin crash",errorReportId:id},aiEngine())
  assert.equal(r.status,200)
  assert.deepEqual(f.calls.at(-1),{name:"upt_god_error_report_mark_working",
   args:{p_token:"short-lived-private-token",p_report:id}})
 }finally{n.restore()}
})
test("AI source cannot use missing repository credentials and will never call GitHub anonymously",async()=>{
 const f=makeDb({credential:null}),old=globalThis.fetch;let count=0
 globalThis.fetch=async()=>{count++;throw Error("Should not request anonymous Github")}
 try{
  const r=await call(f,{message:"Fix Admin crash"},aiEngine())
  assert.equal(r.status,428)
  assert.equal(count,0)
 }finally{globalThis.fetch=old}
})
test("invalid selection is rejected before loading any arbitrary new source",async()=>{
 const f=makeDb(),n=network(),ai=aiEngine({selected:["../../../private.env"]})
 try{
  const response=await call(f,{message:"Fix Admin crash"},ai)
  assert.equal(response.status,502)
  assert.equal(n.seen.filter(x=>x.url.includes("/contents/")).length,1)
 }finally{n.restore()}
})
test("deploy candidate denies Maker text-execution before any GitHub/AI or Main source bridge",async()=>{
 let original=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{original++;throw Error("Legacy proxy must remain unused")}}
 }
 const response=await app.request(origin+"/api/god/text-execution",{
  method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},
  body:JSON.stringify({message:"Fix Admin crash"})
 },env)
 assert.equal(response.status,503)
 assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 assert.equal(original,0)
})
