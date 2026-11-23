import test from "node:test"
import assert from "node:assert/strict"
import {nativeIntegrationMutation} from "../src/api/native-integration-mutations.ts"
import {sealOAuthToken,openOAuthToken} from "../src/api/provider-oauth.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const master=btoa("x".repeat(32))
const event="11111111-1111-4111-8111-111111111111"
const weeztix={
 WEEZTIX_ACCESS_TOKEN:"",
 WEEZTIX_ACTIVE_EVENT_ID:event,
 WEEZTIX_SCANNING_ENABLED:"false",
 WEEZTIX_CLIENT_ID:"my-client",
 WEEZTIX_CLIENT_SECRET:"my-secret"
}
function req(body,method="POST",headers={}){
 return new Request(origin+"/api/administration/integrations",{
  method,headers:{"Content-Type":"application/json",Origin:origin,...headers},
  body:JSON.stringify(body)
 })
}
function fixture({allow=true,permissionError=null,prior={configured:false},saveError=null}={}){
 const calls=[]
 const db={
  rpc:async (name,args)=>{
   calls.push({name,args})
   if(name==="upt_can_manage_integrations")
    return {data:allow,error:permissionError}
   if(name!=="upt_integration_credentials")throw Error("unexpected RPC "+name)
   if(args.p_action==="read")return {data:prior,error:null}
   if(args.p_action==="save")return {data:{configured:true},error:saveError}
   if(args.p_action==="disconnect")return {data:{configured:false},error:saveError}
   throw Error("unrecognized action "+args.p_action)
  }
 }
 return {db,calls}
}
const call=(f,body,method="POST",env={UPT_INTEGRATION_ENCRYPTION_KEY:master},headers={})=>
 nativeIntegrationMutation(f.db,req(body,method,headers),env,method)
test("both credential mutations require the original Administration privilege before reading or changing any vault entry",async()=>{
 for(const method of ["POST","DELETE"]){
  const f=fixture({allow:false})
  const r=await call(f,{provider:"documenso"},method)
  assert.equal(r.status,403)
  assert.deepEqual(f.calls.map(x=>x.name),["upt_can_manage_integrations"])
  const broken=fixture({permissionError:{code:"offline"}})
  assert.equal((await call(broken,{provider:"documenso"},method)).status,503)
  assert.deepEqual(broken.calls.map(x=>x.name),["upt_can_manage_integrations"])
 }
})
test("origin mismatch and missing origin never reach the permission RPC or vault",async()=>{
 for(const method of ["POST","DELETE"]){
  const f=fixture()
  const invalid=await nativeIntegrationMutation(f.db,req({provider:"documenso"},method,{
   Origin:"https://attacker.invalid"
  }),{UPT_INTEGRATION_ENCRYPTION_KEY:master},method)
  assert.equal(invalid.status,403)
  assert.deepEqual(f.calls,[])
 }
})
test("Documenso credential save encrypts and stores only a provider-bound AES-GCM envelope",async()=>{
 const f=fixture()
 const secret="secret-string-not-visible-in-browser"
 const r=await call(f,{provider:"documenso",credentials:{
  DOCUMENSO_BASE_URL:"https://app.documenso.com",DOCUMENSO_API_KEY:secret
 }})
 assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{ok:true,configured:true})
 const save=f.calls.find(x=>x.args?.p_action==="save")
 assert.equal(save.args.p_provider,"documenso")
 assert.ok(save.args.p_ciphertext.startsWith("v1:"))
 assert.ok(!save.args.p_ciphertext.includes(secret))
 const decrypted=await openOAuthToken("documenso",save.args.p_ciphertext,master)
 assert.deepEqual(decrypted,{DOCUMENSO_BASE_URL:"https://app.documenso.com",
  DOCUMENSO_API_KEY:secret})
 await assert.rejects(openOAuthToken("banking",save.args.p_ciphertext,master))
})
test("banking credentials are encrypted per provider; disconnect uses the original vault procedure",async()=>{
 const f=fixture()
 const response=await call(f,{provider:"banking",credentials:{
  PONTO_CLIENT_ID:"id-example-12345",PONTO_CLIENT_SECRET:"secret-example-12345"
 }})
 assert.equal(response.status,200)
 const save=f.calls.find(x=>x.args?.p_action==="save")
 assert.equal(save.args.p_provider,"banking")
 const restored=await openOAuthToken("banking",save.args.p_ciphertext,master)
 assert.equal(restored.PONTO_CLIENT_ID,"id-example-12345")
 const del=await call(f,{provider:"banking"},"DELETE")
 assert.equal(del.status,200)
 assert.deepEqual(await del.json(),{ok:true,configured:false})
 const remove=f.calls.find(x=>x.args?.p_action==="disconnect")
 assert.equal(remove.args.p_provider,"banking")
 assert.equal(remove.args.p_ciphertext,null)
})
test("SumUp and Peppol browser credentials cannot bypass verified provider OAuth consent",async()=>{
 for(const provider of ["sumup","peppol"]){
  const f=fixture()
  const r=await call(f,{provider,credentials:{
   SUMUP_OAUTH_ACCESS_TOKEN:"attacker-input",SUMUP_OAUTH_REFRESH_TOKEN:"attacker-input"
  }})
  assert.equal(r.status,409)
  assert.deepEqual(await r.json(),{error:"connect_via_provider_login"})
  assert.deepEqual(f.calls.map(x=>x.name),["upt_can_manage_integrations"])
 }
})
test("Weeztix manually edited configuration preserves valid server-created OAuth refresh token for unchanged client",async()=>{
 const previous={
  ...weeztix,WEEZTIX_ACCESS_TOKEN:"original-access-token-long",
  WEEZTIX_REFRESH_TOKEN:"original-refresh-token-long",
  WEEZTIX_TOKEN_EXPIRES_AT:"1795000000"
 }
 const cipher=await sealOAuthToken("weeztix",previous,master)
 const f=fixture({prior:{configured:true,ciphertext:cipher}})
 const r=await call(f,{provider:"weeztix",credentials:{
  ...weeztix,WEEZTIX_ACCESS_TOKEN:""
 }})
 assert.equal(r.status,200)
 const save=f.calls.find(x=>x.args?.p_action==="save")
 const restored=await openOAuthToken("weeztix",save.args.p_ciphertext,master)
 assert.equal(restored.WEEZTIX_REFRESH_TOKEN,previous.WEEZTIX_REFRESH_TOKEN)
 assert.equal(restored.WEEZTIX_TOKEN_EXPIRES_AT,previous.WEEZTIX_TOKEN_EXPIRES_AT)
 assert.equal(restored.WEEZTIX_ACCESS_TOKEN,previous.WEEZTIX_ACCESS_TOKEN)
})
test("Weeztix refresh token is not preserved after changing OAuth client and cannot be submitted by the browser",async()=>{
 const previous={
  ...weeztix,WEEZTIX_ACCESS_TOKEN:"original-access-token-long",
  WEEZTIX_REFRESH_TOKEN:"original-refresh-token-long",
  WEEZTIX_TOKEN_EXPIRES_AT:"1795000000"
 }
 const cipher=await sealOAuthToken("weeztix",previous,master)
 const f=fixture({prior:{configured:true,ciphertext:cipher}})
 const r=await call(f,{provider:"weeztix",credentials:{
  ...weeztix,WEEZTIX_CLIENT_ID:"different-client",
  WEEZTIX_ACCESS_TOKEN:"new-access-token-long"
 }})
 assert.equal(r.status,200)
 const saved=await openOAuthToken("weeztix",f.calls.find(x=>x.args?.p_action==="save").args.p_ciphertext,master)
 assert.equal(saved.WEEZTIX_REFRESH_TOKEN,undefined)
 const refused=fixture()
 const res=await call(refused,{provider:"weeztix",credentials:{
  ...weeztix,WEEZTIX_REFRESH_TOKEN:"forged-refresh"
 }})
 assert.equal(res.status,422)
 assert.ok(!refused.calls.some(x=>x.args?.p_action==="save"))
})
test("unrecognized provider, extra top-level input and invalid callback URLs fail closed",async()=>{
 for(const [body,status,error] of [
  [{provider:"eventpay",credentials:{}},422,"invalid_provider"],
  [{provider:"banking",credentials:{},superadmin:true},400,"invalid_body"],
  [{provider:"documenso",credentials:{
   DOCUMENSO_BASE_URL:"https://bad.example",DOCUMENSO_API_KEY:"valid-key"
  }},422,"invalid_credentials"]
 ]){
  const f=fixture()
  const r=await call(f,body)
  assert.equal(r.status,status)
  assert.deepEqual(await r.json(),{error})
  assert.ok(!f.calls.some(x=>x.args?.p_action==="save"))
 }
})
test("invalid master key never stores plaintext, and vault SQL failure never claims a successful connection",async()=>{
 const missing=fixture()
 const r=await call(missing,{provider:"documenso",credentials:{
  DOCUMENSO_BASE_URL:"https://app.documenso.com",DOCUMENSO_API_KEY:"not-leaked"
 }},"POST",{})
 assert.equal(r.status,503)
 assert.deepEqual(await r.json(),{error:"integration_master_key_unavailable"})
 assert.ok(!missing.calls.some(x=>x.args?.p_action==="save"))
 const failed=fixture({saveError:{code:"offline"}})
 const response=await call(failed,{provider:"banking",credentials:{
  PONTO_CLIENT_ID:"client-id",PONTO_CLIENT_SECRET:"some-secret"
 }})
 assert.equal(response.status,503)
 assert.deepEqual(await response.json(),{error:"integration_storage_unavailable"})
})
