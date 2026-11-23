import test from "node:test"
import assert from "node:assert/strict"
import {nativeProviderConnectionCheck} from "../src/api/native-provider-connection.ts"
import {sealOAuthToken,openOAuthToken} from "../src/api/provider-oauth.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const master=btoa("w".repeat(32))
const options={UPT_INTEGRATION_ENCRYPTION_KEY:master}
const request=(provider,headers={})=>new Request(origin+"/api/admin/provider-connection-check",{
 method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
 body:JSON.stringify({provider})
})
async function fixture({grant=true,provider="documenso",config=null,secret=null}={}){
 const calls=[]
 const cipher=config?await sealOAuthToken(provider,config,master):null
 const db={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==="upt_can_manage_integrations")return {data:grant,error:null}
  if(name==="upt_integration_credentials"){
   if(args.p_action==="read")return {data:cipher?{configured:true,ciphertext:cipher}:{configured:false},error:null}
   if(args.p_action==="save")return {data:{configured:true},error:null}
  }
  throw Error("Unexpected RPC "+name)
 }}
 return {db,calls,cipher,secret}
}
test("signed Administration access is checked before credential lookup or provider HTTP",async()=>{
 const f=await fixture({grant:false,config:{
  DOCUMENSO_BASE_URL:"https://app.documenso.com",DOCUMENSO_API_KEY:"sensitive-api-key"
 }})
 const r=await nativeProviderConnectionCheck(f.db,request("documenso"),options)
 assert.equal(r.status,403)
 assert.deepEqual(await r.json(),{status:"unavailable",error:"forbidden"})
 assert.deepEqual(f.calls.map(c=>c.name),["upt_can_manage_integrations"])
 const csrf=await fixture()
 const result=await nativeProviderConnectionCheck(csrf.db,
  request("documenso",{Origin:"https://malicious.invalid"}),options)
 assert.equal(result.status,403)
 assert.deepEqual(csrf.calls,[])
})
test("provider checker refuses other providers, raw URLs, credentials and oversized bodies",async()=>{
 const f=await fixture()
 for(const provider of ["weeztix","events",null]){
  const r=await nativeProviderConnectionCheck(f.db,request(provider),options)
  assert.equal(r.status,422)
 }
 const additional=new Request(origin+"/api/admin/provider-connection-check",{
  method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},
  body:JSON.stringify({provider:"documenso",apiKey:"EXFILTRATE",url:"https://outside.invalid"})
 })
 assert.equal((await nativeProviderConnectionCheck(f.db,additional,options)).status,422)
 assert.ok(!f.calls.some(x=>x.name==="upt_integration_credentials"))
})
test("Documenso probe reads decrypted configuration server-side and returns status without credentials or document contents",async()=>{
 const credentials={DOCUMENSO_BASE_URL:"https://app.documenso.com",
  DOCUMENSO_API_KEY:"sensitive-api-key-123"}
 const f=await fixture({config:credentials})
 const old=globalThis.fetch,seen=[]
 globalThis.fetch=async(url,opts)=>{
  seen.push({url:String(url),headers:opts.headers,method:opts.method})
  return Response.json({documents:[{secret:"cannot-leak"}]})
 }
 try{
  const r=await nativeProviderConnectionCheck(f.db,request("documenso"),options)
  assert.equal(r.status,200)
  const body=await r.json()
  assert.deepEqual(body,{status:"connected",scope:"credentials_only"})
  assert.equal(seen.length,1)
  assert.equal(seen[0].url,"https://app.documenso.com/api/v2/envelope?perPage=1")
  assert.equal(seen[0].headers.Authorization,credentials.DOCUMENSO_API_KEY)
  assert.ok(!JSON.stringify(body).includes("cannot-leak"))
  assert.ok(!JSON.stringify(body).includes(credentials.DOCUMENSO_API_KEY))
  assert.ok(!JSON.stringify(body).includes(master))
 }finally{globalThis.fetch=old}
})
test("unconfigured provider returns exact non-success status without fake connectivity",async()=>{
 const f=await fixture({config:null})
 const old=globalThis.fetch;let count=0
 globalThis.fetch=async()=>{count++;throw Error("No provider request expected")}
 try{
  const r=await nativeProviderConnectionCheck(f.db,request("documenso"),options)
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{status:"not_configured",scope:"credentials_only"})
  assert.equal(count,0)
 }finally{globalThis.fetch=old}
})
test("expired SumUp delegated OAuth grant refreshes with server-side app credentials, persists vault and probes read-only profile",async()=>{
 const now=Math.floor(Date.now()/1000)
 const prior={SUMUP_OAUTH_ACCESS_TOKEN:"expired-access-token",
  SUMUP_OAUTH_REFRESH_TOKEN:"existing-refresh-token",
  SUMUP_OAUTH_EXPIRES_AT:String(now-120)}
 const f=await fixture({provider:"sumup",config:prior})
 const old=globalThis.fetch,seen=[]
 globalThis.fetch=async(url,opts)=>{
  const target=String(url);seen.push({target,method:opts.method,body:opts.body})
  if(target==="https://api.sumup.com/token")return Response.json({
   token_type:"Bearer",access_token:"new-sumup-access-token",
   refresh_token:"rotated-refresh-token",expires_in:3600
  })
  if(target==="https://api.sumup.com/v0.1/me")return Response.json({my_private_name:"not-returned"})
  throw Error("unexpected network "+target)
 }
 try{
  const env={...options,UPT_SUMUP_OAUTH_CLIENT_ID:"our-app-id",
   UPT_SUMUP_OAUTH_CLIENT_SECRET:"our-server-app-secret"}
  const r=await nativeProviderConnectionCheck(f.db,request("sumup"),env)
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{status:"connected",scope:"credentials_only"})
  const saved=f.calls.find(x=>x.args?.p_action==="save")
  assert.ok(saved)
  const restored=await openOAuthToken("sumup",saved.args.p_ciphertext,master)
  assert.equal(restored.SUMUP_OAUTH_ACCESS_TOKEN,"new-sumup-access-token")
  assert.equal(restored.SUMUP_OAUTH_REFRESH_TOKEN,"rotated-refresh-token")
  assert.deepEqual(seen.map(x=>x.target),[
   "https://api.sumup.com/token","https://api.sumup.com/v0.1/me"
  ])
  assert.equal(seen[1].method,"GET")
 }finally{globalThis.fetch=old}
})
test("revoked OAuth grant requires customer's reauthorization and never stores a false green status",async()=>{
 const previous={SUMUP_OAUTH_ACCESS_TOKEN:"expired-access-token",
  SUMUP_OAUTH_REFRESH_TOKEN:"existing-refresh-token",
  SUMUP_OAUTH_EXPIRES_AT:String(Math.floor(Date.now()/1000)-120)}
 const f=await fixture({provider:"sumup",config:previous})
 const old=globalThis.fetch
 globalThis.fetch=async()=>Response.json({error:"invalid_grant"},{status:401})
 try{
  const r=await nativeProviderConnectionCheck(f.db,request("sumup"),{
   ...options,UPT_SUMUP_OAUTH_CLIENT_ID:"our-app-id",
   UPT_SUMUP_OAUTH_CLIENT_SECRET:"our-server-app-secret"
  })
  assert.equal(r.status,409)
  assert.deepEqual(await r.json(),{
   status:"unavailable",error:"provider_reauthorization_required"
  })
  assert.ok(!f.calls.some(x=>x.args?.p_action==="save"))
 }finally{globalThis.fetch=old}
})
test("expired Billit environment remains pinned to its original sandbox/production consent",async()=>{
 const prior={BILLIT_OAUTH_ACCESS_TOKEN:"expired-billit-access",
  BILLIT_OAUTH_REFRESH_TOKEN:"existing-billit-refresh",
  BILLIT_OAUTH_EXPIRES_AT:String(Math.floor(Date.now()/1000)-180),
  BILLIT_OAUTH_ENV:"sandbox"}
 const f=await fixture({provider:"peppol",config:prior})
 const old=globalThis.fetch,targets=[]
 globalThis.fetch=async(url,opts)=>{
  targets.push({url:String(url),method:opts.method})
  if(String(url).endsWith("/OAuth2/token"))return Response.json({
   access_token:"new-billit-access-token",
   refresh_token:"new-billit-refresh-token",expires_in:3600
  })
  return Response.json({id:"sandbox-account-information"})
 }
 try{
  const r=await nativeProviderConnectionCheck(f.db,request("peppol"),{
   ...options,UPT_BILLIT_OAUTH_CLIENT_ID:"our-client",
   UPT_BILLIT_OAUTH_CLIENT_SECRET:"our-client-secret",UPT_BILLIT_OAUTH_ENV:"production"
  })
  assert.equal(r.status,200)
  const saved=f.calls.find(x=>x.args?.p_action==="save")
  assert.ok(saved)
  const decoded=await openOAuthToken("peppol",saved.args.p_ciphertext,master)
  assert.equal(decoded.BILLIT_OAUTH_ENV,"sandbox")
  assert.deepEqual(targets.map(x=>x.url),[
   "https://api.sandbox.billit.be/OAuth2/token",
   "https://api.sandbox.billit.be/v1/account/accountInformation"
  ])
 }finally{globalThis.fetch=old}
})
