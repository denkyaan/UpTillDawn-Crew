import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeMakerAiProposal} from "../src/api/native-maker-ai-proposals.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const god="uptilldawn-god-session=valid-private-token"
const request=(path,payload,headers={})=>new Request(origin+path,{
 method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
 body:JSON.stringify(payload)
})
const files=[{path:"app/page.tsx",content:"export default function Home(){return null}"}]
const source={message:"Werk de applicatie bij",files}
const rule={role:"admin",feature_key:"settings",label:"Settings",
 group_key:"general",visible:true,enabled:true,condition_key:"always",sort_order:10}
const edit={message:"Maak instellingen zichtbaar",role:"admin",path:"/admin",rules:[rule]}
function fixture(owner=false,valid=true){
 const calls=[]
 const db={rpc:async(name,args)=>{
  calls.push([name,args])
  if(name==="upt_god_session_valid")return {data:valid,error:null}
  if(name==="upt_current_is_owner")return {data:owner,error:null}
  throw Error("unexpected RPC "+name)
 }}
 return {db,calls}
}
const ai=(response)=>({run:async(name,opts)=>{
 assert.equal(name,"@cf/meta/llama-3.3-70b-instruct-fp8-fast")
 assert.ok(opts.messages.some(m=>m.role==="system"))
 return {response}
}})
const call=(f,path,payload,engine,cookies=god,env={SUPABASE_URL:qa},headers={})=>
 nativeMakerAiProposal(f.db,request(path,payload,headers),cookies,env,
  path.includes("code-assistant")?"code":"edit",engine)
test("code assistant never accepts missing or expired God token before Workers AI",async()=>{
 const f=fixture()
 let invoked=0
 const engine={run:async()=>{invoked++}}
 assert.equal((await call(f,"/api/god/code-assistant",source,engine,"")).status,401)
 assert.equal(invoked,0)
 assert.deepEqual(f.calls,[])
 const expired=fixture(false,false)
 assert.equal((await call(expired,"/api/god/code-assistant",source,engine)).status,401)
 assert.equal(invoked,0)
})
test("code assistant rejects oversized or unsafe paths and never requests AI",async()=>{
 const f=fixture()
 let invoked=0
 const engine={run:async()=>{invoked++}}
 for(const payload of [
  {message:"hello",files:[{path:"../.env.production",content:"private"}]},
  {message:"x".repeat(8100),files},
  {message:"hello",files:[{path:"app/page.tsx",content:"x".repeat(100001)}]}
 ]){
  const r=await call(f,"/api/god/code-assistant",payload,engine)
  assert.equal(r.status,400)
 }
 assert.equal(invoked,0)
})
test("code assistant safely returns structured reviewable changes without GitHub or SQL writes",async()=>{
 const f=fixture()
 const result={answer:"Voorstel: wijzig de titel",changes:[
  {path:"app/page.tsx",content:"export default function Home(){return <p>Welkom</p>}"},
  {path:"new/readme.md",content:"Nieuwe notitie"}
 ]}
 const r=await call(f,"/api/god/code-assistant",source,ai(result))
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),result)
 assert.deepEqual(f.calls.map(x=>x[0]),["upt_god_session_valid"])
})
test("malformed AI responses and attempts to delete unseen files are rejected",async()=>{
 const f=fixture()
 const unexpected={answer:"x",changes:[{path:"unseen/file.ts",content:null}]}
 assert.equal((await call(f,"/api/god/code-assistant",source,ai(unexpected))).status,409)
 assert.equal((await call(f,"/api/god/code-assistant",source,ai({
  answer:"x",changes:[{path:"../../../.env",content:"secret"}]
 }))).status,502)
 assert.equal((await call(f,"/api/god/code-assistant",source,ai("not-json"))).status,502)
})
test("edit assistant accepts real owner privilege without a separate God cookie",async()=>{
 const f=fixture(true)
 const out={answer:"Verberg menu",patches:[
  {feature_key:"settings",label:null,visible:false,enabled:null,condition_key:null,sort_order:null},
  {feature_key:"not-provided",label:null,visible:false,enabled:null,condition_key:null,sort_order:null}
 ]}
 const r=await call(f,"/api/edit-assistant",edit,ai(out),"")
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{
  answer:"Verberg menu",patches:[out.patches[0]],
  configured:true,provider:"cloudflare-workers-ai"
 })
 assert.deepEqual(f.calls.map(x=>x[0]),["upt_current_is_owner"])
})
test("non-owner can use Edit Mode only with a verified private God cookie",async()=>{
 const f=fixture()
 const result={answer:"Bruikbaar voorstel",patches:[]}
 const rejected=await call(f,"/api/edit-assistant",edit,ai(result),"")
 assert.equal(rejected.status,403)
 const authorized=await call(f,"/api/edit-assistant",edit,ai(result))
 assert.equal(authorized.status,200)
 assert.deepEqual(f.calls.map(x=>x[0]),[
  "upt_current_is_owner","upt_current_is_owner","upt_god_session_valid"
 ])
})
test("cross-origin code and edit assistant requests never call Workers AI",async()=>{
 let called=0
 const engine={run:async()=>{called++}}
 for(const [path,payload] of [
  ["/api/god/code-assistant",source],
  ["/api/edit-assistant",edit]
 ]){
  const f=fixture(true)
  const r=await call(f,path,payload,engine,god,{SUPABASE_URL:qa},
   {Origin:"https://outside.invalid"})
  assert.equal(r.status,403)
 }
 assert.equal(called,0)
})
test("free AI unavailability does not falsely mark an editor request successful",async()=>{
 const f=fixture(true)
 const r=await call(f,"/api/edit-assistant",edit,undefined)
 assert.equal(r.status,503)
 assert.deepEqual(await r.json(),{
  error:"Gratis AI is nog niet beschikbaar op deze deployment.",configured:false
 })
})
test("both AI endpoints are isolated from legacy Worker for anonymous requests",async()=>{
 let proxy=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{proxy++;throw Error("legacy Worker unexpectedly used")}}
 }
 for(const [path,payload] of [
  ["/api/god/code-assistant",source],["/api/edit-assistant",edit]
 ]){
  const result=await app.request(origin+path,{
   method:"POST",headers:{"Content-Type":"application/json",Origin:origin},
   body:JSON.stringify(payload)
  },env)
  assert.equal(result.status,401)
 }
 assert.equal(proxy,0)
})
