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

test("isolated signing worker rejects oversized body without content-length",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const request=new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},
  body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode("x".repeat(3000)));controller.close()}}),
  duplex:"half"
 })
 const response=await worker.fetch(request,env)
 assert.equal(response.status,502)
})
test("isolated signing worker rejects declared oversized body",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-length":"3000"},body:"{}"
 }),env)
 assert.equal(response.status,413)
})

test("isolated signing worker refuses credential-bearing upstream URLs before network access",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://user:password@db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},
  body:JSON.stringify({envelopeId:"abc"})
 }),env)
 assert.equal(response.status,502)
})
