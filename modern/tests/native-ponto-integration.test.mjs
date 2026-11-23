import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativePontoGet,nativePontoPost} from "../src/api/native-ponto-integration.ts"
import {sealOAuthToken} from "../src/api/provider-oauth.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const key=btoa("k".repeat(32))
const account="11111111-1111-4111-8111-111111111111"
const transaction="22222222-2222-4222-8222-222222222222"
const configured={PONTO_CLIENT_ID:"merchant-client-123",PONTO_CLIENT_SECRET:"merchant-secret-456"}
const env={UPT_INTEGRATION_ENCRYPTION_KEY:key}
async function makeFixture({allowed=true,permissionError=null,configuredVault=true,writeError=null}={}){
 const calls=[]
 const cipher=await sealOAuthToken("banking",configured,key)
 const db={rpc:async(name,args)=>{
  calls.push({name,args})
  if(name==="upt_can_manage_integrations")return {data:allowed,error:permissionError}
  if(name==="upt_integration_credentials")return {
   data:configuredVault?{configured:true,ciphertext:cipher}:{configured:false},error:null
  }
  if(name==="upt_admin_import_bank_statement_transactions")
   return {data:{inserted:args.p_rows.length,skipped:0},error:writeError}
  throw Error("unrecognized RPC "+name)
 }}
 return {db,calls}
}
function request(body,headers={}){
 return new Request(origin+"/api/administration/integrations/ponto",{
  method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
  body:JSON.stringify(body)
 })
}
function network(){
 const seen=[]
 const previous=globalThis.fetch
 globalThis.fetch=async(url,options)=>{
  const target=String(url)
  seen.push({url:target,method:options?.method||"GET",headers:options?.headers})
  if(target==="https://api.myponto.com/oauth2/token")
   return Response.json({access_token:"access-token-1234567",scope:"ai pi"})
  if(target==="https://api.myponto.com/accounts?page%5Blimit%5D=100")
   return Response.json({data:[{type:"account",id:account}]})
  if(target.includes("/transactions?page%5Blimit%5D=100"))
   return Response.json({data:[{type:"transaction",id:transaction,relationships:{
    account:{data:{type:"account",id:account}}
   },attributes:{
    currency:"EUR",amount:12.50,valueDate:"2026-11-23T10:30:00Z",
    description:"Validated transaction",remittanceInformation:"123456"
   }}],links:{next:null}})
  throw Error("Unrecognized provider target "+target)
 }
 return {seen,restore:()=>{globalThis.fetch=previous}}
}
test("Ponto GET lists only UUID account choices; no IBAN/transaction/provider secret leaves Worker",async()=>{
 const f=await makeFixture(),net=network()
 try{
  const r=await nativePontoGet(f.db,env)
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{accounts:[{id:account}]})
  assert.equal(r.headers.get("cache-control"),"private, no-store")
  assert.deepEqual(f.calls.map(x=>x.name),["upt_can_manage_integrations","upt_integration_credentials"])
  assert.deepEqual(net.seen.map(x=>x.method),["POST","GET"])
  assert.ok(net.seen.every(x=>x.url.startsWith("https://api.myponto.com/")))
  assert.ok(!JSON.stringify({accounts:[{id:account}]}).includes(configured.PONTO_CLIENT_SECRET))
 }finally{net.restore()}
})
test("Ponto POST fetches only one booked page and imports it through the existing audited SQL reconciliation",async()=>{
 const f=await makeFixture(),net=network()
 try{
  const r=await nativePontoPost(f.db,request({accountId:account}),env)
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{inserted:1,skipped:0,nextCursor:null})
  const importRpc=f.calls.find(x=>x.name==="upt_admin_import_bank_statement_transactions")
  assert.deepEqual(importRpc.args.p_rows,[{
   transactionId:"PONTO:"+account+":"+transaction,bookedOn:"2026-11-23",
   direction:"credit",amountCents:1250,paymentReference:"123456",
   description:"Validated transaction"
  }])
  assert.equal(net.seen.length,3)
  assert.equal(net.seen.filter(x=>x.method==="GET").length,2)
  assert.ok(net.seen.every(x=>!x.url.includes("payments")&&!x.url.includes("transfer")))
 }finally{net.restore()}
})
test("Ponto refuses unprivileged / broken role before fetching encrypted credentials",async()=>{
 for(const options of [{allowed:false},{permissionError:{code:"unavailable"}}]){
  const f=await makeFixture(options)
  const r=await nativePontoGet(f.db,env)
  assert.equal(r.status,options.allowed===false?403:503)
  assert.deepEqual(await r.json(),{error:"access_denied"})
  assert.deepEqual(f.calls.map(x=>x.name),["upt_can_manage_integrations"])
 }
})
test("Ponto refuses unconfigured bank, invalid account UUID and CSRF without reading transactions",async()=>{
 const unconfigured=await makeFixture({configuredVault:false})
 const missing=await nativePontoGet(unconfigured.db,env)
 assert.equal(missing.status,409)
 assert.deepEqual(await missing.json(),{error:"ponto_not_configured"})
 for(const [body,headers,expected] of [
  [{accountId:"../../other",after:null},{},422],
  [{accountId:account,after:"../private"},{},422],
  [{accountId:account,after:null,override:true},{},422],
  [{accountId:account},{Origin:"https://attacker.invalid"},403]
 ]){
  const f=await makeFixture()
  const r=await nativePontoPost(f.db,request(body,headers),env)
  assert.equal(r.status,expected)
  assert.ok(!f.calls.some(x=>x.name==="upt_admin_import_bank_statement_transactions"))
 }
})
test("Ponto's provider rejects a transaction from another account without importing anything",async()=>{
 const f=await makeFixture(),old=globalThis.fetch
 globalThis.fetch=async url=>{
  const path=String(url)
  if(path.endsWith("/oauth2/token"))return Response.json({access_token:"access-token-1234567",scope:"ai"})
  if(path.includes("?page%5Blimit%5D=100")&&path.endsWith("/accounts?page%5Blimit%5D=100"))
   return Response.json({data:[{type:"account",id:account}]})
  return Response.json({data:[{type:"transaction",id:transaction,relationships:{
   account:{data:{type:"account",id:"33333333-3333-4333-8333-333333333333"}}
  },attributes:{currency:"EUR",amount:10,valueDate:"2026-11-23T12:00:00Z"}}]})
 }
 try{
  const r=await nativePontoPost(f.db,request({accountId:account}),env)
  assert.equal(r.status,422)
  assert.deepEqual(await r.json(),{error:"ponto_data_incompatible"})
  assert.ok(!f.calls.some(x=>x.name==="upt_admin_import_bank_statement_transactions"))
 }finally{globalThis.fetch=old}
})
test("both native Ponto POST and provider diagnostic POST are closed on deployed read-only QA before any old Next proxy",async()=>{
 let proxied=0
 const config={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{proxied++;throw Error("legacy Next was invoked")}}}
 for(const path of ["/api/administration/integrations/ponto","/api/admin/provider-connection-check"]){
  const response=await app.request(origin+path,{
   method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},
   body:JSON.stringify({accountId:account})
  },config)
  assert.equal(response.status,503,path)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(proxied,0)
})
