import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import app from "../src/api/worker.ts"
import {administrationCsvResponse} from "../src/api/native-administration-exports.ts"
import {financeCsv} from "../../lib/administration/finance-report.ts"

const origin="https://uptilldawn-modern-main.uptilldawn.workers.dev"
const qa="https://npbjrtiolqperdgljnhi.supabase.co"
const financePath="/api/administration/finance/summary/export"
const ticketsPath="/api/administration/ticketing/event-summary"
const one="aaaabbbb-cccc-dddd-eeee-000000000001"
const two="aaaabbbb-cccc-dddd-eeee-000000000002"
const rows=[
 {event_id:two,source:"weeztix",sale_rows:"2",quantity:"4",gross_cents:"250"},
 {event_id:one,source:"weeztix",sale_rows:"1",quantity:"3",gross_cents:"100"},
 {event_id:two,source:"eventpay",sale_rows:"3",quantity:"5",gross_cents:"500"},
]
function stub(permission=true,data={unpaid:"1",partial:"0",settled:"5",overpaid:"2"},summary=rows){
 const calls=[]
 const db={rpc:async name=>{
  calls.push(name)
  switch(name){
   case "upt_can_manage_administration":return {data:permission,error:null}
   case "upt_administration_finance_summary":return {data,error:null}
   case "upt_ticket_sales_summary":return {data:summary,error:null}
   default:throw Error("unexpected RPC "+name)
  }
 }}
 return {db,calls}
}
test("native CSV never queries finance or sales without original administration grant",async()=>{
 const x=stub(false)
 for(const kind of ["finance","tickets"]){
  const r=await administrationCsvResponse(x.db,kind)
  assert.equal(r.status,403)
  assert.deepEqual(await r.json(),{error:"forbidden"})
 }
 assert.deepEqual(x.calls,["upt_can_manage_administration","upt_can_manage_administration"])
 const broken={rpc:async name=>name==="upt_can_manage_administration"?{data:null,error:{message:"offline"}}:Promise.reject(Error("data breach"))}
 assert.equal((await administrationCsvResponse(broken,"finance")).status,503)
 const crash={rpc:async()=>{throw Error("private backend details")}}
 const denied=await administrationCsvResponse(crash,"tickets")
 assert.equal(denied.status,503)
 assert.deepEqual(await denied.json(),{error:"report_unavailable"})
})
test("original finance CSV is byte-for-byte preserved: BOM, semicolons, CRLF and filename",async()=>{
 const x=stub()
 const r=await administrationCsvResponse(x.db,"finance")
 assert.equal(r.status,200)
 assert.equal(r.headers.get("content-type"),"text/csv; charset=utf-8")
 assert.equal(r.headers.get("content-disposition"),'attachment; filename="invoice-reconciliation-summary.csv"')
 assert.equal(r.headers.get("cache-control"),"private, no-store")
 assert.equal(r.headers.get("x-content-type-options"),"nosniff")
 assert.equal(await r.text(),financeCsv([["status","invoice_count"],["unpaid","1"],["partial","0"],["settled","5"],["overpaid","2"]]))
 assert.deepEqual(x.calls,["upt_can_manage_administration","upt_administration_finance_summary"])
})
test("original ticket CSV retains sorted event aggregation, unique sources and integer cents",async()=>{
 const x=stub()
 const r=await administrationCsvResponse(x.db,"tickets")
 assert.equal(r.status,200)
 assert.equal(r.headers.get("content-disposition"),'attachment; filename="ticket-event-summary.csv"')
 assert.equal(await r.text(),financeCsv([
  ["event_id","source_count","sale_rows","quantity","gross_cents"],
  [one,"1","1","3","100"],
  [two,"2","5","9","750"]
 ]))
 assert.deepEqual(x.calls,["upt_can_manage_administration","upt_ticket_sales_summary"])
})
test("source invalid responses fail closed and cannot be passed as successful exports",async()=>{
 const finance=stub(true,{unpaid:"1",partial:"0",settled:"-1",overpaid:"0"})
 const r1=await administrationCsvResponse(finance.db,"finance")
 assert.equal(r1.status,503)
 assert.deepEqual(await r1.json(),{error:"invalid_report_data"})
 const badTickets=stub(true,{},[{event_id:one,source:"eventpay",sale_rows:"1",quantity:"2",gross_cents:"1.2"}])
 const r2=await administrationCsvResponse(badTickets.db,"tickets")
 assert.equal(r2.status,503)
 assert.deepEqual(await r2.json(),{error:"invalid_report_data"})
 const rpcError={rpc:async name=>name==="upt_can_manage_administration"?{data:true,error:null}:{data:null,error:{code:"offline"}}}
 for(const kind of ["finance","tickets"]){
  const r=await administrationCsvResponse(rpcError,kind)
  assert.equal(r.status,503)
  assert.deepEqual(await r.json(),{error:"report_unavailable"})
 }
})
test("both candidate export paths reject anonymous callers natively, without Next binding",async()=>{
 let forwarded=0
 const env={SUPABASE_URL:qa,SUPABASE_ANON_KEY:"sb_publishable_test",
  UPT_MIGRATION_ALLOW_WRITES:"false",
  MAIN_AUTH:{fetch:async()=>{forwarded++;return Response.json({private:"upstream"})}}
 }
 for(const path of [financePath,ticketsPath]){
  const r=await app.request(origin+path,{},env)
  assert.equal(r.status,401,path)
  assert.deepEqual(await r.json(),{error:"forbidden"})
  assert.equal(r.headers.get("cache-control"),"private, no-store")
 }
 assert.equal(forwarded,0)
})
test("source and new CSV routes share exact validators and require signed RLS permission",()=>{
 const file=path=>readFileSync(new URL(path,import.meta.url),"utf8")
 const originalFinance=file("../../app/api/administration/finance/summary/export/route.ts")
 const originalTickets=file("../../app/api/administration/ticketing/event-summary/route.ts")
 const native=file("../src/api/native-administration-exports.ts")
 const worker=file("../src/api/worker.ts")
 for(const expression of ["financeCsv(","financeSummaryKeys","validateFinanceSummary(","upt_administration_finance_summary"])
  assert.ok(originalFinance.includes(expression)&&native.includes(expression),expression)
 for(const expression of ["financeCsv(","ticketSalesByEvent(","validateTicketSalesSummary(","upt_ticket_sales_summary"])
  assert.ok(originalTickets.includes(expression)&&native.includes(expression),expression)
 assert.ok(native.includes('upt_can_manage_administration'))
 assert.ok(native.includes('["status","invoice_count"]'))
 assert.ok(native.includes('["event_id","source_count","sale_rows","quantity","gross_cents"]'))
 assert.ok(worker.includes('sourceReadSession(c.req.raw,c.env)'))
 assert.ok(worker.includes('attachSourceCookies(await administrationCsvResponse('))
 const qaConfig=JSON.parse(file("../wrangler.main-qa.jsonc"))
 assert.equal(qaConfig.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
})
