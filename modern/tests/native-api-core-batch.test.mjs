import test from "node:test"
import assert from "node:assert/strict"
import app from "../src/api/worker.ts"
import {nativeAdministrationPermission,nativeFinancialAttachment,nativePeppolPreparation} from "../src/api/native-admin-document-routes.ts"
import {nativeBankStatementRegister,nativeProviderSettlementRegister} from "../src/api/native-bank-settlement-registers.ts"
import {nativeBankStatementImport,nativeBankStatementReview,nativeProviderSettlementApprove} from "../src/api/native-bank-settlement-writes.ts"
import {nativeBookingNotesGet,nativeBookingNotesPost} from "../src/api/native-booking-notes.ts"
import {nativePushSubscription,nativeTranslateChat} from "../src/api/native-push-translation.ts"
const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const uid="11111111-1111-4111-8111-111111111111"
const env={SUPABASE_URL:"https://npbjrtiolqperdgljnhi.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_fixture",
 UPT_MIGRATION_ALLOW_WRITES:"false"}
const req=(path,method="GET",body,headers={})=>new Request(origin+path,{
 method,headers:{"Origin":origin,"Sec-Fetch-Site":"same-origin",...headers},
 ...(body===undefined?{}:{body})
})
function q(data,error=null){
 const object={
  select:()=>object,eq:()=>object,is:()=>object,not:()=>object,neq:()=>object,
  in:()=>object,filter:()=>object,ilike:()=>object,limit:()=>object,
  order:()=>object,range:async()=>({data:Array.isArray(data)?data:[data],count:0,error}),
  update:()=>object,
  maybeSingle:async()=>({data,error})
 }
 return object
}
test("signed administrative guard checks Supabase RPC and rejects unknown grants",async()=>{
 assert.equal(await nativeAdministrationPermission({rpc:async()=>({data:true,error:null})}),200)
 assert.equal(await nativeAdministrationPermission({rpc:async()=>({data:false,error:null})}),403)
 assert.equal(await nativeAdministrationPermission({rpc:async()=>({data:true,error:{code:"DENIED"}})}),503)
 assert.equal(await nativeAdministrationPermission({rpc:async()=>{throw Error("NO")}}),503)
})
test("attachment download verifies UUID, metadata RLS, clean scanner AND private signed URL",async()=>{
 let signCalls=0
 const fixture=status=>({
  from:table=>q(table==="admin_financial_attachments"
   ?{storage_path:uid+"/invoice.pdf",original_name:"invoice.pdf"}
   :status==null?null:{status}),
  storage:{from:bucket=>{
   assert.equal(bucket,"admin-financial-attachments")
   return {createSignedUrl:async(path,ttl,opts)=>{
    signCalls++;assert.equal(path,uid+"/invoice.pdf");assert.equal(ttl,60)
    assert.equal(opts.download,"invoice.pdf")
    return {data:{signedUrl:"https://private.invalid/short-lived"},error:null}
   }}
  }}
 })
 const invalid=await nativeFinancialAttachment(fixture("clean"),"bad")
 assert.equal(invalid.status,422);assert.equal(signCalls,0)
 for(const [status,expected] of [["pending",423],["infected",410],["suspicious",410],[null,423]]){
  const response=await nativeFinancialAttachment(fixture(status),uid)
  assert.equal(response.status,expected,status)
  assert.equal(signCalls,0)
 }
 const good=await nativeFinancialAttachment(fixture("clean"),uid)
 assert.equal(good.status,303)
 assert.equal(good.headers.get("location"),"https://private.invalid/short-lived")
 assert.equal(signCalls,1)
})
test("Peppol XML export refuses missing or unsafe document ID and cross-site POST without querying",async()=>{
 const db={from:()=>{throw Error("No DB access before valid id")}}
 const bad=await nativePeppolPreparation(db,req("/api/administration/peppol/prepare?documentId=../../x"),false)
 assert.equal(bad.status,400)
 const foreign=new Request(origin+"/api/administration/peppol/prepare",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":"https://evil.invalid"},
  body:JSON.stringify({documentId:uid})
 })
 assert.equal((await nativePeppolPreparation(db,foreign,true)).status,403)
 const malformed=await nativePeppolPreparation(db,req(
  "/api/administration/peppol/prepare","POST",JSON.stringify({documentId:"invalid"}),
  {"Content-Type":"application/json"}),true)
 assert.equal(malformed.status,400)
})
test("bank/provider registers fail closed on incomplete pagination and only use fixed RLS tables",async()=>{
 const calls=[]
 const db={from:table=>{calls.push(table);return q([])},rpc:async()=>({data:true,error:null})}
 const bank=await nativeBankStatementRegister(db)
 assert.equal(bank.status,503)
 assert.deepEqual(await bank.json(),{error:"statement_or_invoice_data_unavailable"})
 const settle=await nativeProviderSettlementRegister(db)
 assert.equal(settle.status,503)
 assert.deepEqual(await settle.json(),{error:"settlement_register_incomplete"})
 assert.ok(calls.includes("admin_provider_bank_settlements"))
 assert.ok(calls.includes("admin_financial_documents"))
})
test("bank CSV and settlement writes validate at source before RPC, Admin review denies missing right",async()=>{
 let writes=0
 const db={rpc:async name=>{
  if(name==="upt_is_admin")return {data:false,error:null}
  writes++;return {data:true,error:null}
 }}
 const badCsv=await nativeBankStatementImport(db,req(
  "/api/administration/bank-statements","POST",new FormData()))
 assert.equal(badCsv.status,422)
 const adminReview=await nativeBankStatementReview(db,req(
  "/api/administration/bank-statements","PATCH",JSON.stringify({action:"post",statementId:uid,documentId:uid}),
  {"Content-Type":"application/json"}))
 assert.equal(adminReview.status,403)
 const badSettlement=await nativeProviderSettlementApprove(db,req(
  "/api/administration/provider-settlements","POST",JSON.stringify({statementId:uid,feeCents:0,transactionIds:[]}),
  {"Content-Type":"application/json"}))
 assert.equal(badSettlement.status,403)
 assert.equal(writes,0)
})
test("booking notes preserve source search shape and reject cross-origin or invalid writes",async()=>{
 const db={from:table=>{
  assert.equal(table,"admin_artist_bookings")
  const row=q([{id:uid,artist_name:"Studio",status:"confirmed"}])
  row.range=async()=>({data:[{id:uid,artist_name:"Studio",status:"confirmed"}],error:null})
  return row
 }}
 const browse=await nativeBookingNotesGet(db,req("/api/administration/assistant/booking-notes?page=0"))
 assert.equal(browse.status,200)
 assert.deepEqual(await browse.json(),{bookings:[{id:uid,artist_name:"Studio",status:"confirmed"}],hasMore:false,page:0})
 const invalid=await nativeBookingNotesGet(db,req("/api/administration/assistant/booking-notes?page=-1"))
 assert.equal(invalid.status,400)
 const foreign=new Request(origin+"/api/administration/assistant/booking-notes",{
  method:"POST",headers:{"Origin":"https://evil.invalid","Content-Type":"application/json"},body:"{}"
 })
 assert.equal((await nativeBookingNotesPost(db,foreign)).status,403)
 assert.equal((await nativeBookingNotesPost(db,req(
  "/api/administration/assistant/booking-notes","POST","{}",
  {"Content-Type":"application/json"}))).status,400)
})
test("push endpoint validation, revoke RPC, and translation preserve original DTOs",async()=>{
 const calls=[]
 const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:uid,error:null}}}
 const endpoint="https://push.example.net/endpoint"
 const schema={endpoint,keys:{p256dh:"A".repeat(40),auth:"B".repeat(22)},locale:"fr"}
 const save=await nativePushSubscription(db,req(
  "/api/push/subscription","POST",JSON.stringify(schema),
  {"Content-Type":"application/json"}),"POST")
 assert.equal(save.status,200)
 assert.deepEqual(await save.json(),{ok:true,id:uid})
 assert.equal(calls[0][0],"upt_save_push_subscription")
 assert.equal(calls[0][1].p_locale,"fr")
 const remove=await nativePushSubscription(db,req(
  "/api/push/subscription","DELETE",JSON.stringify({endpoint}),
  {"Content-Type":"application/json"}),"DELETE")
 assert.deepEqual(await remove.json(),{ok:true})
 const rejected=await nativePushSubscription(db,req(
  "/api/push/subscription","POST",JSON.stringify({...schema,endpoint:"http://127.0.0.1/evil"}),
  {"Content-Type":"application/json"}),"POST")
 assert.equal(rejected.status,400)
 const tr=await nativeTranslateChat(req("/api/translate-chat","POST",JSON.stringify({
  text:"Hallo @crew",targetLanguage:"en"
 }),{"Content-Type":"application/json"}),{run:async(model,payload)=>{
  assert.equal(model,"@cf/meta/llama-3.1-8b-instruct-fast")
  assert.match(JSON.stringify(payload),/@crew/)
  return {response:"Hello @crew"}
 }})
 assert.deepEqual(await tr.json(),{translated:"Hello @crew"})
 assert.equal((await nativeTranslateChat(req(
  "/api/translate-chat","POST",JSON.stringify({text:"a",targetLanguage:"en"}),
  {"Content-Type":"application/json"}),undefined)).status,503)
})
test("QA mutation block rejects 9 private operations BEFORE auth and before original Main binding",async()=>{
 const paths=[
  ["/api/administration/bank-statements","POST"],
  ["/api/administration/bank-statements","PATCH"],
  ["/api/administration/provider-settlements","POST"],
  ["/api/administration/assistant/booking-notes","POST"],
  ["/api/push/subscription","POST"],
  ["/api/push/subscription","DELETE"],
  ["/api/translate-chat","POST"]
 ]
 let calls=0
 const e={...env,MAIN_AUTH:{fetch:async()=>{calls++;throw Error("FORBIDDEN LEGACY")}}}
 for(const [path,method] of paths){
  const input=req(path,method,"{}",{"Content-Type":"application/json"})
  const res=await app.request(input,{},e)
  assert.equal(res.status,503,path+" "+method)
  assert.deepEqual(await res.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(calls,0)
})
test("all extracted read-only routes reject anonymous requests without forwarding them to legacy",async()=>{
 const paths=[
  "/api/administration/bank-statements",
  "/api/administration/provider-settlements",
  "/api/administration/peppol/prepare?documentId="+uid,
  "/api/administration/finance/attachments/"+uid,
  "/api/administration/assistant/booking-notes"
 ]
 let calls=0
 const e={...env,MAIN_AUTH:{fetch:async()=>{calls++;throw Error("FORBIDDEN LEGACY")}}}
 for(const path of paths){
  const res=await app.request(origin+path,{},e)
  assert.equal(res.status,401,path)
  assert.deepEqual(await res.json(),{error:"access_denied"})
 }
 assert.equal(calls,0)
})
