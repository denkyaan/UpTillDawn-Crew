import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeWeeztixSourceScan} from "../src/api/native-weeztix-original-scan.ts"
import {sealOAuthToken} from "../src/api/provider-oauth.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const event="11111111-1111-4111-8111-111111111111"
const workplace="22222222-2222-4222-8222-222222222222"
const user="33333333-3333-4333-8333-333333333333"
const barcode="WEEZTIX_123456"
const key=btoa("w".repeat(32))
const env={UPT_MIGRATION_SCANNING_ENABLED:"true",
 UPT_SCANNER_ORIGIN:origin+"/",UPT_INTEGRATION_ENCRYPTION_KEY:key}
const identity={id:user,full_name:"Test operator",role:"staff",
 effective_role:"staff",approved:true,account_blocked:false,is_owner:false}
const payload={eventId:event,workplaceId:workplace,barcode}
const request=(body,headers={})=>new Request(origin+"/api/weeztix/scan",{
 method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...headers},
 body:JSON.stringify(body)
})
test("original scanner route rejects invalid Origin, missing approval, blocked operator and disabled scanner before scoped RPC",async()=>{
 const db={rpc:async()=>{throw Error("Must not check provider")}}
 const cross=await nativeWeeztixSourceScan(db,identity,
  request(payload,{Origin:"https://outside.invalid"}),env)
 assert.equal(cross.status,403)
 assert.deepEqual(await cross.json(),{ok:false,code:"forbidden"})
 const pending=await nativeWeeztixSourceScan(db,{...identity,approved:false},
  request(payload),env)
 assert.equal(pending.status,403)
 const blocked=await nativeWeeztixSourceScan(db,{...identity,account_blocked:true},
  request(payload),env)
 assert.equal(blocked.status,403)
 const disabled=await nativeWeeztixSourceScan(db,identity,request(payload),{
  ...env,UPT_MIGRATION_SCANNING_ENABLED:"false"
 })
 assert.equal(disabled.status,503)
 assert.deepEqual(await disabled.json(),{ok:false,code:"not_configured"})
})
test("barcode input is strictly validated before SQL or Weeztix network fetch",async()=>{
 const db={rpc:async()=>{throw Error("No SQL on invalid barcode")}}
 for(const input of [{...payload,barcode:"https://phishing.invalid"},
  {...payload,eventId:"../event"}, {...payload,workplaceId:"wrong"},
  {...payload,extra:"dangerous"},{...payload,barcode:"x".repeat(1020)}]){
  const r=await nativeWeeztixSourceScan(db,identity,request(input),env)
  assert.equal(r.status,422)
  assert.deepEqual(await r.json(),{ok:false,code:"invalid_request"})
 }
})
test("signed entrance-scoped SQL secret and real vendor 204 are the only admission-success route",async()=>{
 const encrypted=await sealOAuthToken("weeztix",{
  WEEZTIX_ACTIVE_EVENT_ID:event,WEEZTIX_SCANNING_ENABLED:"true",
  WEEZTIX_ACCESS_TOKEN:"authorized-operator-weeztix-token"
 },key)
 const rpc=[]
 const db={rpc:async(name,args)=>{
  rpc.push({name,args})
  assert.equal(name,"upt_weeztix_scan_secrets")
  return {data:{configured:true,ciphertext:encrypted},error:null}
 }}
 const old=globalThis.fetch;const provider=[]
 globalThis.fetch=async (url,options)=>{
  provider.push({url:String(url),method:options.method,auth:options.headers.Authorization})
  return new Response(null,{status:204})
 }
 try{
  const r=await nativeWeeztixSourceScan(db,identity,request(payload),env)
  assert.equal(r.status,200)
  assert.deepEqual(await r.json(),{ok:true,code:"admitted"})
  assert.deepEqual(rpc,[{name:"upt_weeztix_scan_secrets",
   args:{p_event_id:event,p_workplace_id:workplace}}])
  assert.deepEqual(provider,[{
   url:"https://api.weeztix.com/order/scanbarcode/"+barcode,
   method:"POST",auth:"Bearer authorized-operator-weeztix-token"
  }])
  assert.equal(r.headers.get("cache-control"),"private, no-store")
 }finally{globalThis.fetch=old}
})
test("valid QR never admits if SQL denies entrance role or vendor rejects barcode",async()=>{
 const old=globalThis.fetch;let provider=0
 globalThis.fetch=async()=>{provider++;return new Response(null,{status:204})}
 try{
  const denied=await nativeWeeztixSourceScan({
   rpc:async()=>({data:null,error:{code:"42501"}})
  },identity,request(payload),env)
  assert.equal(denied.status,403)
  assert.deepEqual(await denied.json(),{ok:false,code:"forbidden"})
  assert.equal(provider,0)
  const encrypted=await sealOAuthToken("weeztix",{
   WEEZTIX_ACTIVE_EVENT_ID:event,WEEZTIX_SCANNING_ENABLED:"true",
   WEEZTIX_ACCESS_TOKEN:"authorized-operator-weeztix-token"
  },key)
  globalThis.fetch=async()=>{provider++;return new Response("rejected",{status:400})}
  const result=await nativeWeeztixSourceScan({
   rpc:async()=>({data:{configured:true,ciphertext:encrypted},error:null})
  },identity,request(payload),env)
  assert.equal(result.status,409)
  assert.deepEqual(await result.json(),{ok:false,code:"provider_rejected"})
 }finally{globalThis.fetch=old}
})
test("old Main browser-facing Weeztix scan is disabled on deployed QA before privileged bridge",async()=>{
 let forwarded=0
 const config={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  UPT_MIGRATION_SCANNING_ENABLED:"false",
  MAIN_AUTH:{fetch:async()=>{forwarded++;throw Error("legacy scanned unexpectedly")}}
 }
 const r=await app.request(origin+"/api/weeztix/scan",{
  method:"POST",headers:{"Content-Type":"application/json",Origin:origin},
  body:JSON.stringify(payload)
 },config)
 assert.equal(r.status,503)
 assert.deepEqual(await r.json(),{error:"migration_writes_disabled"})
 assert.equal(forwarded,0)
})
