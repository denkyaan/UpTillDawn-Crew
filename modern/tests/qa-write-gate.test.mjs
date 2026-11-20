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
test("original read-only view POST and explicitly authorized GET remain available through Main authority",async()=>{
 const f=fixture("false")
 for(const [path,method] of [
  ["/api/migration/view-data","POST"],
  ["/api/administration/finance/export","GET"],
  ["/api/administration/peppol/prepare","GET"]
 ]){
  const response=await probe(path,method,f.env)
  assert.equal(response.status,200,path)
 }
 assert.equal(f.calls,3,"Only the three explicitly read-only probes reach original Main")
})
test("unknown APIs and QA-only test-session endpoints fail closed before original Main service",async()=>{
 const f=fixture("true")
 for(const path of ["/api/test-auth-session","/api/arbitrary","/api/weeztix/scan/hijack"]){
  const response=await probe(path,"POST",f.env)
  assert.equal(response.status,404,path)
 }
 assert.equal(f.calls,0)
})
test("explicitly enabled write transport still uses original Main authorization and never promotes mock identity",async()=>{
 const f=fixture("true")
 const response=await probe("/api/migration/actions","POST",f.env)
 assert.equal(response.status,200)
 assert.equal(f.calls,1)
})
test("deployed QA config cannot enable original Main writes without an explicit security review",()=>{
 const config=JSON.parse(readFileSync(new URL("../wrangler.main-qa.jsonc",import.meta.url),"utf8"))
 assert.equal(config.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
 const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
 assert.ok(workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(!workflow.includes("VITE_MIGRATION_ALLOW_WRITES: 'true'"))
})
