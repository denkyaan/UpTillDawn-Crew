import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeRuntimeScope,runtimeForRequest,MAIN_ORIGIN,CANDIDATE_ORIGIN,MAIN_QA_DATABASE,PRODUCTION_ORIGIN,PRODUCTION_DATABASE} from "../src/api/runtime-scope.ts"
import {nativeMainAuthResponse} from "../src/api/main-auth.ts"
import {sourceReadSession} from "../src/api/native-main-reads.ts"
import {resolveMainGeoapifyKey} from "../src/api/native-main-private-config.ts"
const key="sb_publishable_fixture"
const qa={SUPABASE_URL:MAIN_QA_DATABASE,SUPABASE_ANON_KEY:key}
const direct={...qa,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"true"}
const main={...direct,UPT_MIGRATION_RUNTIME_TARGET:"main-standalone"}
const prod={...direct,SUPABASE_URL:PRODUCTION_DATABASE,UPT_MIGRATION_RUNTIME_TARGET:"production-standalone"}
function login(origin){const body=new FormData();body.set("portal","staff");body.set("email","");body.set("password","");return new Request(origin+"/api/auth/portal-login",{method:"POST",headers:{Origin:origin},body})}
test("scope is a deployment decision, never a caller-controlled origin or database",()=>{
 assert.equal(runtimeForRequest(CANDIDATE_ORIGIN,qa)?.projectUrl,MAIN_QA_DATABASE)
 assert.equal(runtimeForRequest(MAIN_ORIGIN,main)?.projectUrl,MAIN_QA_DATABASE)
 assert.equal(runtimeForRequest(PRODUCTION_ORIGIN,prod)?.projectUrl,PRODUCTION_DATABASE)
 for(const [url,env] of [[MAIN_ORIGIN,qa],[CANDIDATE_ORIGIN,main],[MAIN_ORIGIN,prod],[PRODUCTION_ORIGIN,main],[PRODUCTION_ORIGIN,{...prod,SUPABASE_URL:MAIN_QA_DATABASE}],[MAIN_ORIGIN,{...main,SUPABASE_URL:PRODUCTION_DATABASE}],[MAIN_ORIGIN,{...main,UPT_MIGRATION_NATIVE_AUTH_ENABLED:"false"}],[MAIN_ORIGIN,{...main,MAIN_AUTH_RUNTIME:{}}],[PRODUCTION_ORIGIN,{...prod,MAIN_AUTH:{}}],[MAIN_ORIGIN,{...main,UPT_MIGRATION_RUNTIME_TARGET:"unknown"}]])
  assert.equal(runtimeForRequest(url,env),null)
 assert.equal(nativeRuntimeScope({...qa,SUPABASE_URL:PRODUCTION_DATABASE}),null)
})
test("standalone auth and signed routes accept only the exact runtime scope, without any network call",async()=>{
 const original=globalThis.fetch
 globalThis.fetch=async()=>{throw Error("unexpected network call")}
 try{
  for(const [origin,env] of [[MAIN_ORIGIN,main],[PRODUCTION_ORIGIN,prod]]){
   const response=await nativeMainAuthResponse(login(origin),env)
   assert.equal(response.status,200);assert.equal(response.headers.get("x-uptilldawn-auth-runtime"),"native-original-source")
   assert.deepEqual(await response.json(),{error:"E-mail en wachtwoord zijn verplicht."})
   assert.deepEqual(await sourceReadSession(new Request(origin+"/api/push/config"),env),{ok:false,status:401})
   assert.equal(await resolveMainGeoapifyKey({...env,GEOAPIFY_API_KEY:"fixture"}),"fixture")
   assert.equal(await resolveMainGeoapifyKey(env),"")
   const health=await app.request(origin+"/api/v1/health",{},env)
   assert.equal(health.status,200)
   assert.equal(health.headers.get("x-uptilldawn-auth-protocol"),"native-direct-v1")
   assert.equal((await app.request(CANDIDATE_ORIGIN+"/api/v1/health",{},env)).status,503)
  }
  assert.equal((await nativeMainAuthResponse(login(PRODUCTION_ORIGIN),main)).status,503)
  assert.equal((await nativeMainAuthResponse(login(MAIN_ORIGIN),prod)).status,503)
 }finally{globalThis.fetch=original}
})

test("foreign Supabase cookie cannot trigger a session lookup across Main and Production",async()=>{
 const original=globalThis.fetch
 let requests=0
 globalThis.fetch=async()=>{requests++;throw Error("unexpected network call")}
 try{
  for(const [origin,env,foreign] of [[MAIN_ORIGIN,main,"eakoavcieossazqzplke"],[PRODUCTION_ORIGIN,prod,"npbjrtiolqperdgljnhi"]]){
   assert.deepEqual(await sourceReadSession(new Request(origin+"/api/push/config",{headers:{Cookie:"sb-"+foreign+"-auth-token.0=fixture"}}),env),{ok:false,status:401})
  }
  assert.equal(requests,0)
 }finally{globalThis.fetch=original}
})
