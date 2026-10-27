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
 assert.equal(response.status,413)
})
test("isolated signing worker rejects declared oversized body",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json","content-length":"3000"},body:"{}"
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

test("isolated worker rejects null JSON input without network access",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:"null"
 }),env)
 assert.equal(response.status,400)
})
test("isolated worker rejects upstream URLs with unexpected path prefixes",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example/untrusted",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})
 }),env)
 assert.equal(response.status,502)
})

test("isolated worker rejects unexpected request fields before network access",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},
  body:JSON.stringify({envelopeId:"abc",nextState:"completed"})
 }),env)
 assert.equal(response.status,400)
})

test("isolated worker requires JSON media type",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
  method:"POST",headers:{authorization:"Bearer internal","content-type":"text/plain"},body:JSON.stringify({envelopeId:"abc"})
 }),env)
 assert.equal(response.status,415)
})

test("isolated worker blocks private, local and metadata upstream hosts",async()=>{
 for(const host of ["localhost","127.0.0.1","10.0.0.5","172.16.0.1","192.168.1.2","169.254.169.254","service.internal","service.test","service.invalid","[::1]"]){
  const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://"+host,DOCUMENSO_TOKEN:"token"}
  const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
   method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})
  }),env)
  assert.equal(response.status,502,host)
 }
})

test("isolated worker rejects null provider response without updating ledger",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const originalFetch=globalThis.fetch
 let calls=0
 globalThis.fetch=async()=>{
  calls++
  if(calls===1)return new Response(JSON.stringify([{envelope_id:"abc",status:"sent",signed_pdf_path:null}]),{status:200})
  if(calls===2)return new Response("null",{status:200})
  throw Error("Unexpected database mutation")
 }
 try{
  const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
   method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})
  }),env)
  assert.equal(response.status,409)
  assert.equal(calls,2)
 }finally{globalThis.fetch=originalFetch}
})

test("isolated worker reconciles completed provider state using conditional database transition",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const originalFetch=globalThis.fetch
 const calls=[]
 globalThis.fetch=async (url,options={})=>{
  calls.push({url:String(url),options})
  if(calls.length===1)return new Response(JSON.stringify([{envelope_id:"abc",status:"sent",signed_pdf_path:null}]))
  if(calls.length===2)return new Response(JSON.stringify({id:"abc",status:"COMPLETED"}))
  if(calls.length===3)return new Response("true")
  throw Error("Unexpected network request")
 }
 try{
  const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
   method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})
  }),env)
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),{state:"completed",updated:true})
  assert.equal(calls.length,3)
  assert.match(calls[2].url,/\/rpc\/upt_server_transition_contract_signing$/)
  assert.deepEqual(JSON.parse(calls[2].options.body),{p_envelope_id:"abc",p_expected_status:"sent",p_next_status:"completed"})
 }finally{globalThis.fetch=originalFetch}
})

test("isolated worker refuses malformed ledger rows before contacting provider",async()=>{
 const env={INTERNAL_SIGNING_TOKEN:"internal",SUPABASE_SECRET:"secret",SUPABASE_URL:"https://db.example",DOCUMENSO_URL:"https://sign.example",DOCUMENSO_TOKEN:"token"}
 const originalFetch=globalThis.fetch
 for(const row of [null,[],{envelope_id:"abc",status:"sent",signed_pdf_path:"signed.pdf"},{envelope_id:"wrong",status:"sent",signed_pdf_path:null}]){
  let calls=0
  globalThis.fetch=async()=>{
   calls++
   if(calls===1)return new Response(JSON.stringify([row]))
   throw Error("Provider must not be contacted")
  }
  try{
   const response=await worker.fetch(new Request("https://worker.example/internal/signing/sync",{
    method:"POST",headers:{authorization:"Bearer internal","content-type":"application/json"},body:JSON.stringify({envelopeId:"abc"})
   }),env)
   assert.equal(response.status,409)
   assert.equal(calls,1)
  }finally{globalThis.fetch=originalFetch}
 }
})
