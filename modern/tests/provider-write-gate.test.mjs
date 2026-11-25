
import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_fixture",
 UPT_MIGRATION_RUNTIME_TARGET:"main-qa",UPT_MIGRATION_ALLOW_WRITES:"false",
 UPT_MIGRATION_OAUTH_ENABLED:"true",UPT_MIGRATION_SCANNING_ENABLED:"true",
 UPT_PROVIDER_OAUTH_ORIGIN:origin,UPT_SCANNER_ORIGIN:origin,
 UPT_SUMUP_OAUTH_CLIENT_ID:"synthetic-client",UPT_SUMUP_OAUTH_CLIENT_SECRET:"synthetic-secret",
 UPT_BILLIT_OAUTH_CLIENT_ID:"synthetic-client",UPT_BILLIT_OAUTH_CLIENT_SECRET:"synthetic-secret",
 UPT_INTEGRATION_ENCRYPTION_KEY:Buffer.alloc(32,22).toString("base64")}
test("accidentally enabled provider flags cannot bypass the global read-only gate",async()=>{
 const old=globalThis.fetch
 let requests=0
 globalThis.fetch=async()=>{requests++;throw Error("unexpected network call")}
 try{
  for(const path of ["/api/v1/integrations/oauth/start","/api/v1/integrations/oauth/complete","/api/v1/tickets/weeztix/scan"]){
   const request=(headers={})=>new Request(origin+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},body:JSON.stringify({provider:"sumup"})})
   const anonymous=await app.request(request(),{},env)
   assert.equal(anonymous.status,401,path)
   for(const writes of ["false",undefined]){
    const result=await app.request(request({Authorization:"Bearer "+"x".repeat(64)}),{},{...env,UPT_MIGRATION_ALLOW_WRITES:writes})
    assert.equal(result.status,503,path)
    const body=await result.json()
    assert.equal(body.code||body.error,path.includes("/tickets/")?"scanner_disabled":"migration_writes_disabled")
    assert.match(result.headers.get("cache-control"),/no-store/)
   }
  }
  assert.equal(requests,0)
 }finally{globalThis.fetch=old}
})
