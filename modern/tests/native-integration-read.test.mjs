import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeIntegrationsSummary} from "../src/api/native-integration-read.ts"
import {sealIntegrationSecrets} from "../../lib/administration/integration-crypto.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const master=btoa("z".repeat(32))
const weeztix={
 WEEZTIX_CLIENT_ID:"client-12345",WEEZTIX_CLIENT_SECRET:"secret-12345",
 WEEZTIX_ACCESS_TOKEN:"",
 WEEZTIX_ACTIVE_EVENT_ID:"11111111-1111-4111-8111-111111111111",
 WEEZTIX_SCANNING_ENABLED:"false"
}
const summary=[{provider:"weeztix",updated_at:"2026-11-22T14:00:00Z",
 updated_by:"11111111-1111-4111-8111-111111111111"}]
const audit=[{provider:"weeztix",action:"connected",actor_name:"Admin",
 occurred_at:"2026-11-22T14:00:00Z"}]
function fixture({allowed=true,permissionError=null,listed=summary,audited=audit,
 weeztixRow={configured:false},resultError=null}={}){
 const calls=[]
 const db={rpc:async (name,args)=>{
  calls.push([name,args])
  if(name==="upt_can_manage_integrations")return {data:allowed,error:permissionError}
  if(name==="upt_integration_audit_recent")return {data:audited,error:resultError}
  if(name==="upt_integration_credentials"){
   if(args.p_action==="list")return {data:listed,error:resultError}
   if(args.p_action==="read"&&args.p_provider==="weeztix")return {data:weeztixRow,error:resultError}
  }
  throw Error("Unexpected integrations RPC: "+name)
 }}
 return {db,calls}
}
const read=(db,env={},route="/api/administration/integrations")=>
 nativeIntegrationsSummary(db,new Request(origin+route),env)
test("native integration settings GET returns exactly the original redacted summaries and audit",async()=>{
 const f=fixture()
 const r=await read(f.db)
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{
  integrations:summary,audit,weeztixOauthReady:false,
  weeztixOauthCallbackUrl:null,secureStoreAvailable:false
 })
 assert.equal(r.headers.get("cache-control"),"no-store")
 assert.deepEqual(f.calls.map(x=>x[0]),[
  "upt_can_manage_integrations",
  "upt_integration_credentials","upt_integration_audit_recent","upt_integration_credentials"
 ])
})
test("unapproved integration managers cannot list encrypted config or historical audit",async()=>{
 const f=fixture({allowed:false})
 const r=await read(f.db)
 assert.equal(r.status,403)
 assert.deepEqual(await r.json(),{error:"forbidden"})
 assert.deepEqual(f.calls.map(x=>x[0]),["upt_can_manage_integrations"])
 const broken=fixture({permissionError:{code:"offline"}})
 assert.equal((await read(broken.db)).status,503)
 assert.equal(broken.calls.length,1)
})
test("stored Weeztix OAuth readiness is decrypted inside Worker, not leaked to browser",async()=>{
 const encrypted=await sealIntegrationSecrets("weeztix",weeztix,master)
 const f=fixture({weeztixRow:{configured:true,ciphertext:encrypted}})
 const env={UPT_INTEGRATION_ENCRYPTION_KEY:master}
 const r=await read(f.db,env)
 assert.equal(r.status,200)
 const out=await r.json()
 assert.equal(out.weeztixOauthReady,true)
 assert.equal(out.secureStoreAvailable,true)
 assert.ok(!JSON.stringify(out).includes(encrypted))
 assert.ok(!JSON.stringify(out).includes("secret-12345"))
 assert.ok(!JSON.stringify(out).includes(master))
})
test("missing master key or malformed encrypted Weeztix settings are never reported as ready",async()=>{
 const encrypted=await sealIntegrationSecrets("weeztix",weeztix,master)
 const f=fixture({weeztixRow:{configured:true,ciphertext:encrypted}})
 const r=await read(f.db)
 assert.equal(r.status,503)
 assert.deepEqual(await r.json(),{error:"integration_storage_unavailable"})
 const malformed=fixture({weeztixRow:{configured:true,ciphertext:"v1:invalid"}})
 assert.equal((await read(malformed.db,{UPT_INTEGRATION_ENCRYPTION_KEY:master})).status,503)
})
test("invalid or oversized integration metadata returns failure, never partial credentials",async()=>{
 for(const args of [
  {listed:[{provider:"unknown",updated_at:"now"}]},
  {audited:[{provider:"weeztix",action:"credential_read",actor_name:"Admin",occurred_at:"now"}]},
  {resultError:{code:"offline"}},
  {weeztixRow:{configured:"private"}}
 ]){
  const f=fixture(args)
  const r=await read(f.db)
  assert.equal(r.status,503)
  assert.deepEqual(await r.json(),{error:"integration_storage_unavailable"})
 }
})
test("Weeztix OAuth link is hidden on read-only QA until explicit matching HTTPS configuration",async()=>{
 const f=fixture()
 const bad=await read(f.db,{
  UPT_MIGRATION_OAUTH_ENABLED:"true",UPT_WEEZTIX_OAUTH_ORIGIN:"https://attacker.invalid/"
 })
 assert.equal((await bad.json()).weeztixOauthCallbackUrl,null)
 const off=await read(f.db,{
  UPT_MIGRATION_OAUTH_ENABLED:"false",UPT_WEEZTIX_OAUTH_ORIGIN:origin+"/"
 })
 assert.equal((await off.json()).weeztixOauthCallbackUrl,null)
 const configured=await read(f.db,{
  UPT_MIGRATION_OAUTH_ENABLED:"true",UPT_WEEZTIX_OAUTH_ORIGIN:origin+"/"
 })
 assert.equal((await configured.json()).weeztixOauthCallbackUrl,
  origin+"/api/administration/integrations/weeztix/callback")
})
test("original GET runs natively but POST/DELETE remain blocked on QA before any Next proxy",async()=>{
 let fallback=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{fallback++;return Response.json({unexpected:true})}}}
 const get=await app.request(origin+"/api/administration/integrations",{},env)
 assert.equal(get.status,401)
 assert.deepEqual(await get.json(),{error:"forbidden"})
 for(const method of ["POST","DELETE"]){
  const r=await app.request(origin+"/api/administration/integrations",{
   method,headers:{"Content-Type":"application/json",Origin:origin},
   body:JSON.stringify({provider:"weeztix"})
  },env)
  assert.equal(r.status,503)
  assert.deepEqual(await r.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(fallback,0)
})
