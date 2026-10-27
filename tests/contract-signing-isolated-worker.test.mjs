import test from "node:test"
import assert from "node:assert/strict"
import worker from "../workers/contract-signing-sync.mjs"
test("isolated signing worker fails closed without credentials",async()=>{
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{method:"POST"}),{})
 assert.equal(response.status,503)
})
test("isolated signing worker rejects public requests",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})}),env)
 assert.equal(response.status,401)
})
test("isolated signing worker has no public endpoint",async()=>{
 const response=await worker.fetch(new Request("https://worker.example/"),{})
 assert.equal(response.status,404)
})
