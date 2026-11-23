import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
function fixture(flag){
 let calls=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  ...(flag===undefined?{}:{UPT_MIGRATION_ALLOW_WRITES:flag}),
  MAIN_AUTH:{async fetch(){calls++;return Response.json({value:null})}}}
 return {env,get calls(){return calls}}
}
function probe(path,method="POST",env){
 return app.request(origin+path,{method,headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",
  ...(method==="POST"||method==="PATCH"?{"Content-Type":"application/json"}:{})},
  ...(method==="GET"||method==="HEAD"?{}:{body:"{}"})},env)
}
test("candidate write flag disabled or absent blocks ALL original Main action/provider writes before any service binding",async()=>{
 const requests=[
  ["/api/migration/actions","POST"],
  ["/api/weeztix/scan","POST"],
  ["/api/administration/bank-statements","POST"],
  ["/api/administration/provider-mappings/123","PATCH"],
  ["/api/administration/integrations","DELETE"],
  ["/api/administration/provider-mappings","POST"],
  ["/api/administration/provider-transactions","POST"],
  ["/api/administration/finance/invoice-lines/import","POST"],
  ["/api/god/source","POST"],
  ["/api/administration/integrations/oauth/sumup/start","GET"],
  ["/api/administration/integrations/oauth/sumup/callback","GET"],
  ["/api/administration/integrations/weeztix/start","GET"],
  ["/api/administration/integrations/weeztix/callback","GET"],
 ]
 for(const flag of [undefined,"false","FALSE","0"]){
  const f=fixture(flag)
  for(const [path,method] of requests){
   const response=await probe(path,method,f.env)
   assert.equal(response.status,503,path+"/"+method+" flag="+flag)
   assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
   assert.equal(response.headers.get("cache-control"),"private, no-store")
  }
  assert.equal(f.calls,0,"No candidate business mutation may reach the Main Worker")
 }
})
test("only remaining legacy read DTO proxies; extracted financial and Peppol endpoints require signed sessions",async()=>{
 const f=fixture("false")
 const legacy=await probe("/api/migration/view-data","POST",f.env)
 assert.equal(legacy.status,200)
 assert.equal(f.calls,1)
 const finance=await probe("/api/administration/finance/export","GET",f.env)
 assert.equal(finance.status,401,"Extracted finance export rejects unsigned requests")
 const peppol=await probe("/api/administration/peppol/prepare","GET",f.env)
 assert.equal(peppol.status,401,"Extracted Peppol read rejects unsigned requests")
 assert.equal(f.calls,1,"Native finance and Peppol never contact the original Worker")
})
test("unknown APIs and QA-only test-session endpoints fail closed before original Main service",async()=>{
 const f=fixture("true")
 for(const path of ["/api/test-auth-session","/api/arbitrary","/api/weeztix/scan/hijack"]){
  const response=await probe(path,"POST",f.env)
  assert.equal(response.status,404,path)
 }
 assert.equal(f.calls,0)
})
test("explicitly enabled QA writes still reject unknown actions locally and never promote mock identity",async()=>{
 const f=fixture("true")
 const response=await probe("/api/migration/actions","POST",f.env)
 assert.equal(response.status,404)
 assert.deepEqual(await response.json(),{error:"unknown_action"})
 assert.equal(f.calls,0)
})
test("deployed QA config cannot enable original Main writes without an explicit security review",()=>{
 const config=JSON.parse(readFileSync(new URL("../wrangler.main-qa.jsonc",import.meta.url),"utf8"))
 assert.equal(config.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
 const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
 assert.ok(workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(!workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'true'"))
})
