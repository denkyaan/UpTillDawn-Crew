import test from "node:test"
import assert from "node:assert/strict"
import {readBoundedFormData} from "../../lib/bounded-form-data.ts"
import {forwardMainAuth,MAIN_AUTH_ORIGIN} from "../src/api/main-auth.ts"
import {readBoundedUpstreamJson} from "../src/api/native-bounded-upstream.ts"
import {nativeGeoapifyAutocompleteResponse} from "../src/api/native-standalone-routes.ts"
import {report} from "../scripts/legacy-route-audit.mjs"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const makeAdmin=(body,extra={})=>new Request(origin+"/api/auth/admin-login",{
 method:"POST",body,headers:{Origin:origin,"Sec-Fetch-Site":"same-origin",...extra}})
const adminEnv={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
 MAIN_AUTH_RUNTIME:{runtimeConfiguration:async()=>({protocol:"main-auth-native-v1",projectUrl:qa,values:{}})}}
const signedDb={rpc:async name=>({data:name==="upt_is_approved"?true:{allowed:true},error:null})}
const addressUrl=language=>origin+"/api/geocode/autocomplete?q=Kerkstraat&lang="+language
test("Admin no-JS URL-encoded form remains bounded and is compiled from original source",async()=>{
 const body=new URLSearchParams({email:"",password:"a+b& z é"})
 const values=await readBoundedFormData(makeAdmin(body),16_384,true)
 assert.equal(values.get("password"),"a+b& z é")
 await assert.rejects(readBoundedFormData(makeAdmin(body),16_384),/invalid_form/)
 const response=await forwardMainAuth(makeAdmin(new URLSearchParams({email:"",password:""})),adminEnv)
 assert.equal(response.status,303)
 assert.match(response.headers.get("location"),/\/login\/admin\?error=/)
 assert.equal(response.headers.get("x-uptilldawn-auth-runtime"),"native-original-source")
})
test("Admin URL-encoded input is translated to upstream multipart without forwarded privileges",async()=>{
 const body=new URLSearchParams({email:"qa@example.invalid",password:"a+b & é"})
 const response=await forwardMainAuth(makeAdmin(body,{
  "Cf-Iplatitude":"50.881","Cf-Iplongitude":"4.701",Authorization:"Bearer forge","X-Role":"owner"
 }),{SUPABASE_URL:qa,MAIN_AUTH:{fetch:async r=>{
  assert.equal(r.url,MAIN_AUTH_ORIGIN+"/api/auth/admin-login")
  assert.equal(r.headers.get("cf-iplatitude"),"50.881")
  assert.equal(r.headers.get("cf-iplongitude"),"4.701")
  assert.equal(r.headers.get("authorization"),null)
  assert.equal(r.headers.get("x-role"),null)
  const fields=await r.formData()
  assert.equal(fields.get("password"),"a+b & é")
  return new Response(null,{status:303,headers:{location:MAIN_AUTH_ORIGIN+"/admin"}})
 }}})
 assert.equal(response.status,303)
 assert.equal(response.headers.get("location"),origin+"/admin")
})
test("Admin rejects oversized URL form, unsupported charset and foreign origins before backend",async()=>{
 let count=0
 const env={SUPABASE_URL:qa,MAIN_AUTH:{fetch:async()=>{count++;throw Error("backend entered")}}}
 for(const [r,status] of [
  [makeAdmin(new URLSearchParams({email:"a",password:"x".repeat(19_000)})),413],
  [makeAdmin("email=a",{"Content-Type":"application/x-www-form-urlencoded; charset=latin1"}),415],
  [makeAdmin(new URLSearchParams({email:"a"}),{Origin:"https://foreign.invalid"}),403],
  [new Request(origin+"/api/auth/portal-login",{method:"POST",
    headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},body:"portal=staff"}),415]
 ])assert.equal((await forwardMainAuth(r,env)).status,status)
 assert.equal(count,0)
})
test("untrusted upstream reader enforces actual bytes and strict UTF-8 regardless of missing headers",async()=>{
 assert.equal(await readBoundedUpstreamJson(new Response("{}",{headers:{"Content-Length":"999999"}}),100),null)
 let cancelled=false
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(80));c.enqueue(new Uint8Array(80))},cancel(){cancelled=true}})
 assert.equal(await readBoundedUpstreamJson(new Response(stream),100),null)
 assert.equal(cancelled,true)
 assert.equal(await readBoundedUpstreamJson(new Response(new Uint8Array([255])),100),null)
 assert.equal(await readBoundedUpstreamJson(new Response("invalid-json"),100),null)
 assert.deepEqual(await readBoundedUpstreamJson(Response.json({ok:true}),256),{ok:true})
})
test("Geoapify preserves source-normalized address and language across four supported locales",async()=>{
 const old=globalThis.fetch
 const row={place_id:"BE1",lat:50.881,lon:4.701,formatted:"Kerkstraat 7",
  street:"Kerkstraat",housenumber:"7",city:"Leuven",postcode:"3000",country_code:"be"}
 try{
  for(const lang of ["nl","fr","en","de"]){
   globalThis.fetch=async(url,options)=>{
    const q=new URL(url).searchParams
    assert.equal(q.get("lang"),lang)
    assert.equal(q.get("limit"),"6")
    assert.equal(q.get("apiKey"),"fixture")
    assert.equal(options.cache,"no-store")
    return Response.json({results:[row]})
   }
   const result=await nativeGeoapifyAutocompleteResponse(signedDb,new Request(addressUrl(lang)),"fixture")
   assert.equal(result.status,200)
   const data=await result.json()
   assert.equal(data.results.length,1)
   assert.equal(data.results[0].formatted,"Kerkstraat 7")
   assert.equal(data.results[0].streetAddress,"Kerkstraat 7")
   assert.equal(data.results[0].countryCode,"BE")
  }
 }finally{globalThis.fetch=old}
})
test("Geoapify rejects oversized streamed, malformed and invalid UTF8 responses instead of exhausting Free Worker",async()=>{
 const original=globalThis.fetch
 try{
  for(const payload of [new Response("{}",{headers:{"Content-Length":"999999"}}),
   new Response(new Uint8Array(260_000)),new Response("not-json"),
   new Response(new Uint8Array([255,0]))]){
   globalThis.fetch=async()=>payload
   const r=await nativeGeoapifyAutocompleteResponse(signedDb,new Request(addressUrl("nl")),"fixture")
   assert.equal(r.status,502)
   assert.deepEqual(await r.json(),{error:"Locaties konden niet worden opgezocht."})
  }
 }finally{globalThis.fetch=original}
})
test("cutover still blocks all four legacy-default authentication methods and keyless Geoapify",()=>{
 assert.deepEqual([...report.pending].sort(),[
  "GET /api/geocode/autocomplete [conditional-legacy-provider]",
  "GET /auth/callback [legacy-auth-default]",
  "POST /api/auth/account-action [legacy-auth-default]",
  "POST /api/auth/admin-login [legacy-auth-default]",
  "POST /api/auth/portal-login [legacy-auth-default]"
 ].sort())
 assert.equal(report.allOriginalPairsAccountedFor,true)
 assert.equal(report.fullCutoverAllowed,false)
})
