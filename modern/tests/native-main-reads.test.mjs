import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {hasOriginalAuthCookie,sourceReadSession,pushConfigResponse,portalPreferenceResponse} from "../src/api/native-main-reads.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const config={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_fixture",UPT_MIGRATION_ALLOW_WRITES:"false"}
const request=(path,method="GET",body,extras={})=>new Request(origin+path,{
 method,headers:{"Origin":origin,...extras},...(body===undefined?{}:{body})
})
function bridge(){
 let forwarded=0
 const env={...config,MAIN_AUTH:{fetch:async request=>{
  forwarded++
  assert.equal(new URL(request.url).origin,"https://uptilldawn-main.uptilldawn.workers.dev")
  return Response.json({value:"source-fallback"},{headers:{"Cache-Control":"no-store"}})
 }}}
 return {env,forwarded:()=>forwarded}
}

test("original cookies are only negative fast-rejects; never bearer roles or PKCE verifier",()=>{
 assert.equal(hasOriginalAuthCookie(""),false)
 assert.equal(hasOriginalAuthCookie("sb-npbjrtiolqperdgljnhi-auth-token-code-verifier=fake"),false)
 assert.equal(hasOriginalAuthCookie("role=admin; uptilldawn-last-portal=administration"),false)
 assert.equal(hasOriginalAuthCookie("sb-npbjrtiolqperdgljnhi-auth-token=synthetic"),true)
 assert.equal(hasOriginalAuthCookie("sb-npbjrtiolqperdgljnhi-auth-token.0=synthetic"),true)
})
test("unauthorized native Main read never sends anonymous or arbitrary cookies to original Next",async()=>{
 const x=bridge()
 const push=await app.request(origin+"/api/push/config",{},x.env)
 assert.equal(push.status,401)
 assert.deepEqual(await push.json(),{error:"Aanmelden vereist."})
 const pref=await app.request(request("/api/migration/view-data","POST",JSON.stringify({id:"portal-preference",args:[]}),{"Content-Type":"application/json"}),{},x.env)
 assert.equal(pref.status,401)
 assert.deepEqual(await pref.json(),{error:"view_data_unavailable"})
 assert.equal(x.forwarded(),0)
})
test("original Main preference values preserve exactly the persisted workspace allowlist",async()=>{
 for(const role of ["events","promotion","administration"]){
  const response=portalPreferenceResponse("uptilldawn-last-portal="+role)
  assert.deepEqual(await response.json(),{value:{lastPortal:role}})
 }
 for(const value of ["admin","god","../../etc",""]){
  const response=portalPreferenceResponse("uptilldawn-last-portal="+value)
  assert.deepEqual(await response.json(),{value:{lastPortal:null}})
 }
})
test("push config preserves original result and fail-closed key response with no Next dependency",async()=>{
 const calls=[]
 const result=await pushConfigResponse({rpc:async name=>{
  calls.push(name)
  return name==="upt_push_public_key"?{data:"BFixturePublicKey",error:null}:{data:4,error:null}
 }})
 assert.equal(result.status,200)
 assert.deepEqual(await result.json(),{publicKey:"BFixturePublicKey",unreadCount:4})
 assert.deepEqual(calls.sort(),["upt_notification_badge_count","upt_push_public_key"])
 const partial=await pushConfigResponse({rpc:async name=>name==="upt_push_public_key"?{data:"BFixturePublicKey",error:null}:{data:null,error:{code:"FAKE"}}})
 assert.deepEqual(await partial.json(),{publicKey:"BFixturePublicKey",unreadCount:0})
 const unavailable=await pushConfigResponse({rpc:async()=>({data:null,error:{code:"not_configured"}})})
 assert.equal(unavailable.status,503)
 assert.deepEqual(await unavailable.json(),{error:"Push is nog niet geconfigureerd."})
})
test("read-only source boundary fails closed on wrong host/database or missing signed context",async()=>{
 const a=await sourceReadSession(new Request(origin+"/api/push/config"),config)
 assert.deepEqual(a,{ok:false,status:401})
 const b=await sourceReadSession(new Request("https://attacker.invalid/api/push/config"),config)
 assert.deepEqual(b,{ok:false,status:503})
 const c=await sourceReadSession(new Request(origin+"/api/push/config"),{...config,SUPABASE_URL:"https://production.invalid"})
 assert.deepEqual(c,{ok:false,status:503})
 const source=readFileSync(new URL("../src/api/native-main-reads.ts",import.meta.url),"utf8")
 assert.ok(source.includes('db.rpc("upt_current_session_context")'))
 assert.ok(source.includes("parseIdentity("))
 assert.ok(source.includes("isActive("))
 assert.ok(!source.includes("SERVICE_ROLE_KEY"))
})
test("all original view-data IDs fail closed without signed identity or Next proxy",async()=>{
 const x=bridge()
 for(const id of ["portal-preference","god-session-rpc","external-services",
  "external-services-view","signing-connection","artist-signing-preflight","invalid"]){
  const other=await app.request(request("/api/migration/view-data","POST",
   JSON.stringify({id,args:["sales"]}),{"Content-Type":"application/json"}),{},x.env)
  assert.equal(other.status,401,id)
  assert.deepEqual(await other.json(),{error:"view_data_unavailable"})
 }
 assert.equal(x.forwarded(),0)
 const denied=await app.request(request("/api/migration/view-data","POST",
  JSON.stringify({id:"portal-preference",args:[]}),{
   "Content-Type":"application/json","Origin":"https://attacker.invalid"
  }),{},x.env)
 assert.equal(denied.status,403)
 assert.equal(x.forwarded(),0)
 const unauthorizedWrite=await app.request(request("/api/migration/actions","POST",
  new FormData(),{"Origin":origin}),{},x.env)
 assert.equal(unauthorizedWrite.status,503)
 assert.equal(x.forwarded(),0)
})
