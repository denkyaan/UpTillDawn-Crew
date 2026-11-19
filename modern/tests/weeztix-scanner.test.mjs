import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {scannerReady,scannerOrigin,validScanRequest,tokenResponse,scanWeeztix} from "../src/api/weeztix-scan.ts"
import {sealOAuthToken} from "../src/api/provider-oauth.ts"
import {isEntranceWorkplace,validWeeztixBarcode,scanCopy,scanNotice} from "../src/shared/weeztix-scan.ts"
import {languages} from "../src/shared/i18n.ts"
const origin="https://modern-candidate.invalid"
const uid="11111111-1111-4111-8111-111111111111"
const post="22222222-2222-4222-8222-222222222222"
const barcode="WEEZTIX_123456"
const key=Buffer.alloc(32,42).toString("base64")
const env={UPT_MIGRATION_SCANNING_ENABLED:"true",UPT_SCANNER_ORIGIN:origin,
 UPT_INTEGRATION_ENCRYPTION_KEY:key}
const input={eventId:uid,workplaceId:post,barcode}
const src=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8")
test("scanner authorization and URL scope default to off, exact HTTPS only",()=>{
 assert.equal(scannerReady({},origin+"/api/v1/tickets/weeztix/scan"),false)
 assert.equal(scannerReady({...env,UPT_MIGRATION_SCANNING_ENABLED:"false"},origin+"/x"),false)
 assert.equal(scannerReady(env,origin+"/x"),true)
 assert.equal(scannerOrigin(env,"https://attacker.invalid/x"),null)
 assert.equal(scannerOrigin({...env,UPT_SCANNER_ORIGIN:"http://modern-candidate.invalid"},origin+"/x"),null)
 assert.equal(scannerOrigin({...env,UPT_SCANNER_ORIGIN:origin+"/redirect"},origin+"/x"),null)
})
test("strict QR/entrance scope does not mistake arbitrary QR or payment posts for tickets",()=>{
 for(const name of ["Inkom","Ticket scan","Entrance / Guestlist","Ticketcontrole","contrôle des billets"]){
  assert.equal(isEntranceWorkplace(name),true,name)
 }
 for(const name of ["Bar","Merch","Tokens","Backstage","Guestlist","Ticket scan / Bar","Inkom + Merch"]){
  assert.equal(isEntranceWorkplace(name),false,name)
 }
 assert.equal(validWeeztixBarcode(barcode),true)
 for(const bad of ["https://x.example/path","ABC 123","wrong/qr","not","x".repeat(161),"\u0000xx",""]){
  assert.equal(validWeeztixBarcode(bad),false,JSON.stringify(bad))
 }
 assert.equal(validScanRequest(input),true)
 for(const bad of [{...input,eventId:"wrong"},{...input,workplaceId:"wrong"},
  {...input,barcode:"https://phish.invalid"},{...input,extra:"unsafe"}]){
  assert.equal(validScanRequest(bad),false)
 }
})
test("all four locale translations admit ONLY confirmed provider response",()=>{
 for(const language of languages){
  const copy=scanCopy[language]
  for(const label of ["accepted","rejected","denied","unknown","note","inactive","manual","cameraError"]){
   assert.ok(copy[label].length>5,language+":"+label)
  }
  assert.equal(scanNotice({ok:true,code:"admitted"},language),copy.accepted)
  assert.notEqual(scanNotice({ok:false,code:"provider_unavailable"},language),copy.accepted)
 }
})
test("invalid bearer, disabled scanner and unauthorized origin cannot contact database",async()=>{
 const path="/api/v1/tickets/weeztix/scan"
 const noAuth=await app.request(origin+path,{method:"POST",body:JSON.stringify(input)},env)
 assert.equal(noAuth.status,401)
 assert.equal((await noAuth.json()).ok,false)
 const off=await app.request(origin+path,{method:"POST",headers:{
  Authorization:"Bearer "+"x".repeat(36),"Content-Type":"application/json",Origin:origin
 },body:JSON.stringify(input)}, {...env,UPT_MIGRATION_SCANNING_ENABLED:"false"})
 assert.equal(off.status,503)
 assert.equal((await off.json()).code,"scanner_disabled")
 const wrongOrigin=await app.request(origin+path,{method:"POST",headers:{
  Authorization:"Bearer "+"x".repeat(36),"Content-Type":"application/json",Origin:"https://attacker.invalid"
 },body:JSON.stringify(input)},env)
 assert.equal(wrongOrigin.status,403)
 assert.equal((await wrongOrigin.json()).code,"forbidden")
})
test("Weeztix token parser checks raw provider tokens and expiry bounds",()=>{
 const item={token_type:"Bearer",access_token:"a".repeat(24),refresh_token:"r".repeat(25),expires_in:3600}
 const valid=tokenResponse(item,1700000000000)
 assert.equal(valid?.WEEZTIX_TOKEN_EXPIRES_AT,String(1700000000+3600-30))
 assert.equal(tokenResponse({...item,token_type:"Basic"}),null)
 assert.equal(tokenResponse({...item,expires_in:0}),null)
 assert.equal(tokenResponse({...item,refresh_token:"invalid\n"}),null)
})
test("scoped AES credentials + vendor 204 admit; provider reject/404/429 fail closed",async()=>{
 const ciphertext=await sealOAuthToken("weeztix",{
  WEEZTIX_ACTIVE_EVENT_ID:uid,WEEZTIX_SCANNING_ENABLED:"true",
  WEEZTIX_ACCESS_TOKEN:"t".repeat(35)
 },key)
 let reads=0
 const db={rpc:async(name)=>{
  assert.equal(name,"upt_weeztix_scan_secrets")
  reads++
  return {data:{configured:true,ciphertext},error:null}
 }}
 const original=globalThis.fetch
 const statuses=[[204,200,"admitted",true],[400,409,"provider_rejected",false],
  [404,404,"ticket_not_found",false],[429,503,"provider_busy",false]]
 try{
  for(const [vendorStatus,status,code,ok] of statuses){
   globalThis.fetch=async(url,init)=>{
    assert.equal(url,"https://api.weeztix.com/order/scanbarcode/"+barcode)
    assert.equal(init.method,"POST")
    assert.equal(init.headers.Authorization,"Bearer "+"t".repeat(35))
    return new Response(vendorStatus===204?null:"blocked",{status:vendorStatus})
   }
   const outcome=await scanWeeztix(db,env,input)
   assert.deepEqual(outcome,{status,body:{ok,code}})
  }
  assert.equal(reads,statuses.length)
 }finally{globalThis.fetch=original}
})
test("missing, wrong event and denied scoped secret cannot reach vendor",async()=>{
 const orig=globalThis.fetch
 let fetched=0;globalThis.fetch=async()=>{fetched++;throw Error("must-not-call")}
 try{
  const denied=await scanWeeztix({rpc:async()=>({data:null,error:{code:"42501"}})},env,input)
  assert.equal(denied.status,403)
  const missing=await scanWeeztix({rpc:async()=>({data:{configured:false},error:null})},env,input)
  assert.equal(missing.body.code,"not_configured")
  const wrong=await sealOAuthToken("weeztix",{
   WEEZTIX_ACTIVE_EVENT_ID:post,WEEZTIX_SCANNING_ENABLED:"true",
   WEEZTIX_ACCESS_TOKEN:"t".repeat(35)
  },key)
  const event=await scanWeeztix({rpc:async()=>({data:{configured:true,ciphertext:wrong},error:null})},env,input)
  assert.equal(event.body.code,"not_configured")
  assert.equal(fetched,0)
 }finally{globalThis.fetch=orig}
})
test("refresh lease deduplicates rotation and never exposes provider token",async()=>{
 const soon=String(Math.floor(Date.now()/1000)+500)
 const ciphertext=await sealOAuthToken("weeztix",{
  WEEZTIX_ACTIVE_EVENT_ID:uid,WEEZTIX_SCANNING_ENABLED:"true",
  WEEZTIX_ACCESS_TOKEN:"expired_old_token_1234",WEEZTIX_REFRESH_TOKEN:"refresh_token_123456",
  WEEZTIX_CLIENT_ID:"client",WEEZTIX_CLIENT_SECRET:"secret_1234567890",
  WEEZTIX_TOKEN_EXPIRES_AT:soon
 },key)
 let claims=0,commits=0,releases=0,providerRequests=0
 const db={rpc:async(name,params)=>{
  if(name==="upt_weeztix_scan_secrets")return {data:{configured:true,ciphertext},error:null}
  if(name==="upt_weeztix_claim_refresh"){claims++;return {data:"33333333-3333-4333-8333-333333333333",error:null}}
  if(name==="upt_weeztix_commit_refresh"){commits++;assert.equal(params.p_previous_ciphertext,ciphertext);return {data:true,error:null}}
  if(name==="upt_weeztix_release_refresh"){releases++;return {data:true,error:null}}
  throw Error("unexpected_rpc "+name)
 }}
 const original=globalThis.fetch
 try{
  globalThis.fetch=async(url,init)=>{
   if(url==="https://auth.weeztix.com/tokens"){
    providerRequests++
    assert.equal(init.method,"POST")
    return Response.json({token_type:"Bearer",access_token:"new_token_abcdefghijkl",
      refresh_token:"new_refresh_abcdefgh",expires_in:3600})
   }
   assert.equal(url,"https://api.weeztix.com/order/scanbarcode/"+barcode)
   assert.equal(init.headers.Authorization,"Bearer new_token_abcdefghijkl")
   return new Response(null,{status:204})
  }
  const answer=await scanWeeztix(db,env,input)
  assert.deepEqual(answer,{status:200,body:{ok:true,code:"admitted"}})
  assert.deepEqual([claims,commits,releases,providerRequests],[1,1,1,1])
 }finally{globalThis.fetch=original}
})
test("candidate scanner is scoped to one operational tab and local-only QR decoding",()=>{
 const scanner=src("components/weeztix-scanner.tsx"),ops=src("screens/operations.tsx")
 assert.ok(ops.includes("isEntranceWorkplace(p.name)"))
 assert.ok(ops.includes("<WeeztixScanner key={p.id} eventId={p.event_id} workplaceId={p.id}/>"))
 assert.ok(scanner.includes('script.src="/vendor/jsqr-1.4.0.js"'))
 assert.ok(scanner.includes("navigator.mediaDevices.getUserMedia"))
 assert.ok(scanner.includes("getTracks().forEach(track=>track.stop())"))
 assert.ok(scanner.includes("CANDIDATE_TICKET_SCANNING_ENABLED"))
 assert.ok(scanner.includes("previous.current.time<10000"))
 assert.ok(!scanner.includes("localStorage"))
 assert.ok(!scanner.includes("setInterval"))
 const route=src("api/worker.ts")
 assert.ok(route.includes('app.post("/api/v1/tickets/weeztix/scan"'))
 assert.ok(route.includes("Origin"))
 assert.ok(route.includes("scopedActor(c)"))
 const server=src("api/weeztix-scan.ts")
 assert.ok(server.includes('rpc("upt_weeztix_scan_secrets"'))
 assert.ok(server.includes('rpc("upt_weeztix_claim_refresh"'))
 assert.ok(server.includes('rpc("upt_weeztix_commit_refresh"'))
 assert.ok(server.includes('rpc("upt_weeztix_release_refresh"'))
 assert.ok(server.includes('response.status===204'))
 assert.ok(!server.includes("service_role"))
})
