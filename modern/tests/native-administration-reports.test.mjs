import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {administrationReportResponse} from "../src/api/native-administration-reports.ts"
import {reportProviderTransactions} from "../../lib/administration/provider-transaction-report.ts"
import {salesReconciliationCsv,salesReconciliationExceptionsCsv} from "../../lib/administration/sales-reconciliation-report.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const event="aaaabbbb-cccc-dddd-eeee-000000000001"
const payments=[{
 id:"aaaabbbb-cccc-dddd-eeee-000000000002",event_id:event,
 provider:"sumup",transaction_id:"payment-test-1",category:"tickets",
 sale_reference:"tix-1",status:"paid",amount_cents:"10000",
 currency:"EUR",occurred_at:"2026-11-22T11:00:00Z"
}]
const mappings=[{
 id:"aaaabbbb-cccc-dddd-eeee-000000000003",
 provider:"eventpay",external_event_id:"RAVE-1",event_id:event,
 enabled:true,created_at:"2026-11-22T11:00:00Z"
}]
function dbFixture({allow=true,permissionError=null,paymentsResult=payments,mappingsResult=mappings,
 paymentCount=paymentsResult.length,mappingError=null,paymentError=null}={}){
 const calls=[]
 const query=(table)=>{
  const chain={
   select:(...args)=>{calls.push([table,"select",...args]);return chain},
   order:(...args)=>{calls.push([table,"order",...args]);return chain},
   range:(...args)=>{calls.push([table,"range",...args]);return Promise.resolve({
    data:paymentsResult,error:paymentError,count:paymentCount
   })},
   limit:(...args)=>{calls.push([table,"limit",...args]);return Promise.resolve({
    data:mappingsResult,error:mappingError
   })}
  }
  return chain
 }
 const db={
  rpc:async name=>{calls.push(["rpc",name]);return {data:allow,error:permissionError}},
  from:table=>{calls.push(["from",table]);return query(table)}
 }
 return {db,calls}
}
async function bodyBytes(response){return Buffer.from(await response.arrayBuffer()).toString("utf8")}
test("provider mapping register uses original limit, descending order and RLS; no legacy bridge",async()=>{
 const f=dbFixture()
 const response=await administrationReportResponse(f.db,"provider-mappings",origin+"/api/administration/provider-mappings")
 assert.equal(response.status,200)
 assert.deepEqual(await response.json(),{mappings,canActivate:true})
 assert.deepEqual(f.calls,[
  ["rpc","upt_can_manage_administration"],
  ["from","admin_provider_event_mappings"],
  ["admin_provider_event_mappings","select","id,provider,external_event_id,event_id,enabled,created_at"],
  ["admin_provider_event_mappings","order","created_at",{ascending:false}],
  ["admin_provider_event_mappings","limit",200]
 ])
 const unavailable=await administrationReportResponse(dbFixture({mappingError:{code:"db"}}).db,"provider-mappings",origin)
 assert.equal(unavailable.status,503)
 assert.deepEqual(await unavailable.json(),{error:"mapping_read_failed"})
})
test("provider reconciliation report and BOTH CSV variants retain source outputs byte-for-byte",async()=>{
 const expected=reportProviderTransactions(payments)
 for(const [query,filename,csv] of [
  ["",null,null],
  ["?export=net",'attachment; filename="provider-sales-reconciliation.csv"',salesReconciliationCsv(expected)],
  ["?export=exceptions",'attachment; filename="provider-sales-exceptions.csv"',salesReconciliationExceptionsCsv(expected)]
 ]){
  const f=dbFixture()
  const response=await administrationReportResponse(f.db,"provider-transactions",origin+"/api/administration/provider-transactions"+query)
  assert.equal(response.status,200)
  assert.ok(f.calls.some(x=>x[0]==="admin_provider_transactions"&&x[1]==="range"&&x[2]===0&&x[3]===5000))
  if(filename){
   assert.equal(response.headers.get("content-disposition"),filename)
   assert.equal(response.headers.get("content-type"),"text/csv; charset=utf-8")
   assert.equal(await bodyBytes(response),csv)
  }else assert.deepEqual(await response.json(),{report:expected,transactionCount:1})
 }
})
test("permission is reverified on every report request before reading any financial data",async()=>{
 for(const kind of ["provider-mappings","provider-transactions"]){
  const refused=dbFixture({allow:false})
  const response=await administrationReportResponse(refused.db,kind,origin)
  assert.equal(response.status,403)
  assert.deepEqual(await response.json(),{error:"access_denied"})
  assert.deepEqual(refused.calls,[["rpc","upt_can_manage_administration"]])
  const expired=dbFixture({allow:false,permissionError:{code:"offline"}})
  const unavailable=await administrationReportResponse(expired.db,kind,origin)
  assert.equal(unavailable.status,503)
  assert.deepEqual(expired.calls,[["rpc","upt_can_manage_administration"]])
 }
})
test("malformed query, incomplete snapshot and invalid provider totals fail closed",async()=>{
 const invalid=dbFixture()
 const bad=await administrationReportResponse(invalid.db,"provider-transactions",origin+"?export=../../accounts")
 assert.equal(bad.status,400)
 assert.deepEqual(await bad.json(),{error:"invalid_export"})
 assert.deepEqual(invalid.calls,[["rpc","upt_can_manage_administration"]])
 for(const fixture of [
  dbFixture({paymentCount:5001}),
  dbFixture({paymentCount:null}),
  dbFixture({paymentCount:0}),
  dbFixture({paymentError:{code:"offline"}})
 ]){
  const response=await administrationReportResponse(fixture.db,"provider-transactions",origin)
  assert.equal(response.status,503)
  assert.deepEqual(await response.json(),{error:"reconciliation_unavailable_or_too_large"})
 }
 const invalidPayment=dbFixture({paymentsResult:[{...payments[0],currency:"USD"}]})
 const invalidResponse=await administrationReportResponse(invalidPayment.db,"provider-transactions",origin)
 assert.equal(invalidResponse.status,503)
 assert.deepEqual(await invalidResponse.json(),{error:"invalid_reconciliation_data"})
})
test("both provider GET routes deny anonymous access and never forward to old Next",async()=>{
 let legacy=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_fixture",
 UPT_MIGRATION_ALLOW_WRITES:"false",MAIN_AUTH:{fetch:async()=>{legacy++;return Response.json({private:true})}}}
 for(const path of ["/api/administration/provider-mappings","/api/administration/provider-transactions",
  "/api/administration/provider-transactions?export=net"]){
  const response=await app.request(origin+path,{},env)
  assert.equal(response.status,401)
  assert.deepEqual(await response.json(),{error:"access_denied"})
 }
 for(const path of ["/api/administration/provider-mappings","/api/administration/provider-transactions"]){
  const response=await app.request(origin+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:"{}"},env)
  assert.equal(response.status,503)
  assert.deepEqual(await response.json(),{error:"migration_writes_disabled"})
 }
 assert.equal(legacy,0)
})
test("native provider report uses the exact source report serializers and query bounds",()=>{
 const source=readFileSync(new URL("../../app/api/administration/provider-transactions/route.ts",import.meta.url),"utf8")
 const native=readFileSync(new URL("../src/api/native-administration-reports.ts",import.meta.url),"utf8")
 for(const term of ["reportProviderTransactions(","salesReconciliationCsv(","salesReconciliationExceptionsCsv(",".range(0,5000)"]){
  assert.ok(source.includes(term)&&native.includes(term),term)
 }
 assert.ok(native.includes('upt_can_manage_administration'))
 assert.ok(!native.includes('MAIN_AUTH'))
})
