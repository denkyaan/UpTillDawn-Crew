import {assertOriginalSourceRoutes} from './helpers/modern-original-source-contract.mjs'
import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"

const read=path=>readFileSync(path,"utf8")
test("ten additional operational reads are bounded, cancellable and use existing PostgREST RLS",()=>{
 const source=read("modern/src/lib/extended-reads.ts")
 const expected=[
  ["ownTimesheets","timesheets"],["ownTimeReviews","time_review_requests"],
  ["allowedSales","sales_transactions"],["allowedInventoryIssues","inventory_issues"],
  ["allowedSettlements","inventory_settlement_requests"],["allowedMovements","inventory_movements"],
  ["adminTicketImports","admin_ticket_imports"],["adminTicketSales","admin_ticket_sales"],
  ["adminContractSignatures","administration_contract_signing_requests"],
  ["adminTimesheets","timesheets"],
 ]
 for(const [method,table] of expected){
  assert.ok(source.includes("export async function "+method+"("),method+" missing")
  assert.ok(source.includes('.from("'+table+'")'),"Expected RLS table "+table)
 }
 const counts=source.match(/\.limit\((\d+)\)\.abortSignal\(signal\)/g)||[]
 assert.equal(counts.length,expected.length)
 assert.ok([...source.matchAll(/\.limit\((\d+)\)\.abortSignal\(signal\)/g)].every(x=>Number(x[1])<=100))
 assert.ok(!source.includes('.select("*")'))
 assert.ok(!source.includes("service_role"))
 assert.ok(!/\.update\(|\.insert\(|\.delete\(/.test(source))
 assert.ok(!/recipient_email|national_register_number|iban/.test(source))
})
test("local-first additional panels share one authenticated bounded-read component",()=>{
 const source=read("modern/src/components/history-panel.tsx")
 assert.ok(source.includes("useSession()"))
 assert.ok(source.includes("usePrivateQuery<HistoryRow[]>"))
 assert.ok(source.includes('const r=usePrivateQuery<HistoryRow[]>(uid,"history:"+kind'))
 assert.ok(source.includes('import("../lib/export-csv")'))
 assert.ok(source.includes("r.loading||Boolean(r.error)||!r.data?.length"))
 const count=(source.match(/exportFile:/g)||[]).length
 assert.ok(count>=10)
 assert.ok(!source.includes("localStorage"))
 assert.ok(!source.includes("indexedDB"))
})
test("crew, administration, operations add grouped functions without extra top-level portal nav",()=>{
 const crew=read("modern/src/screens/crew.tsx")
 const admin=read("modern/src/screens/administration.tsx")
 const ops=read("modern/src/screens/operations.tsx")
 for(const kind of ['time-reviews','issued-items','settlements'])
  assert.ok(crew.includes('kind="'+kind+'"'))
 assert.ok(crew.includes('const TimesheetWorkspace=lazy(()=>import("./timesheet-workspace"))'))
 assert.ok(crew.includes('<TimesheetWorkspace/>'))
 for(const kind of ['ticket-imports','ticket-sales','contracts'])
  assert.ok(admin.includes('kind="'+kind+'"'))
 assert.ok(admin.includes('const TimesheetWorkspace=lazy(()=>import("./timesheet-workspace"))'))
 assert.ok(admin.includes('<TimesheetWorkspace review/>'))
 for(const kind of ['movements','sales'])
  assert.ok(ops.includes('kind="'+kind+'"'))
 assertOriginalSourceRoutes()
})
test("nothing turns off the migration cutover lock or enables unverified writes",()=>{
 const doc=read("modern/README.md")
 const env=read("modern/.env.example")
 const inv=read("modern/scripts/inventory.mjs")
 assert.ok(doc.includes("NOT PRODUCTION-READY"))
 assert.ok(env.includes("VITE_MIGRATION_ALLOW_WRITES=false"))
 assert.ok(inv.includes("productionCutoverAllowed:false"))
 assert.ok(inv.includes("verifiedPages:0"))
})
