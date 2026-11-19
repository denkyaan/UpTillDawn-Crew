import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"

const invoke=(path,auth,env)=>app.request("https://candidate.invalid"+path,{
 method:"GET",headers:auth?{Authorization:auth}:{}
},env||{})
test("privileged candidate endpoints never expose anonymous data",async()=>{
 for(const endpoint of ["/api/v1/integrations/status","/api/v1/god/diagnostics"]){
  for(const token of [undefined,"Bearer abc","Bearer "+("a".repeat(9000))]){
   const r=await invoke(endpoint,token)
   assert.equal(r.status,401)
   assert.deepEqual(await r.json(),{error:"authentication_required"})
   assert.equal(r.headers.get("cache-control"),"private, no-store")
  }
 }
})
test("authenticated-looking tokens without configured provider fail closed",async()=>{
 for(const endpoint of ["/api/v1/integrations/status","/api/v1/god/diagnostics"]){
  const r=await invoke(endpoint,"Bearer "+"a".repeat(60))
  assert.equal(r.status,503)
  assert.deepEqual(await r.json(),{error:"service_unconfigured"})
 }
})
test("sensitive provider write, God Mode write and OAuth routes are not enabled",async()=>{
 for(const endpoint of [
  "/api/v1/integrations/oauth/sumup/start",
  "/api/v1/integrations/oauth/peppol/callback",
  "/api/v1/god/code",
  "/api/v1/god/deploy"
 ]){
  const r=await app.request("https://candidate.invalid"+endpoint)
  assert.equal(r.status,404)
 }
 for(const endpoint of ["/api/v1/integrations/status","/api/v1/god/diagnostics"]){
  const r=await app.request("https://candidate.invalid"+endpoint,{method:"POST"})
  assert.equal(r.status,404)
 }
})
