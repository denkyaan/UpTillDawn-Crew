import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {allocateEventBreaks} from "../src/shared/payroll-policy.ts"
const source=readFileSync(new URL("../sql/break-payroll-grace-reconciliation.candidate.sql",import.meta.url),"utf8")
const fixtures=readFileSync(new URL("../sql/break-payroll-grace-fixtures.sql",import.meta.url),"utf8")
const p=(id,breakSeconds,grossSeconds=14400)=>({sessionId:id,start:"2026-11-19T12:00:00Z",breakSeconds,grossSeconds})
test("event grace boundary: deductible only AFTER 70 minutes, then entire overage beyond 60",()=>{
 for(const [seconds,expected] of [[0,0],[3600,0],[4140,0],[4200,0],[4201,601],[4260,660],[5400,1800]]){
  assert.equal(allocateEventBreaks([p("first",seconds)])[0].deductedSeconds,expected,String(seconds))
 }
})
test("split breaks use a single event allowance and retroactive trigger across sessions",()=>{
 const one={...p("a",3900),start:"2026-11-19T12:00:00Z"}
 const two={...p("b",360),start:"2026-11-19T14:00:00Z"}
 const allocated=allocateEventBreaks([two,one])
 assert.deepEqual(allocated.map(x=>x.deductedSeconds),[300,360])
 assert.equal(allocated.reduce((x,y)=>x+y.deductedSeconds,0),660)
 assert.equal(allocateEventBreaks([one,{...two,breakSeconds:300}]).reduce((x,y)=>x+y.deductedSeconds,0),0)
 assert.equal(allocated.reduce((x,y)=>x+y.payableSeconds,0),28800-660)
})
test("payroll pure reference rejects duplicated, negative, implausible and fractional data",()=>{
 for(const bad of [[p("a",10),p("a",20)],[p("a",-1)],[p("a",50,40)],
  [p("a",0.5)],[{...p("a",10),start:"not-date"}]]){
  assert.throws(()=>allocateEventBreaks(bad))
 }
})
test("SQL candidate preserves authorization and payroll safeguards, shares a private formula",()=>{
 assert.ok(source.includes("create or replace function upt_private.break_deduction_seconds"))
 assert.ok(source.includes("p_event_total<=4200"))
 assert.ok(source.includes("return greatest(p_used-greatest(3600-p_prior,0),0)"))
 assert.equal((source.match(/upt_private.break_deduction_seconds\(/g)||[]).length,4) // create, revoke, two consumers
 assert.ok(source.includes("from public,anon,authenticated"))
 assert.ok(source.includes("IF NOT public.upt_is_approved()"))
 assert.ok(source.includes("public.upt_is_responsible"))
 assert.ok(source.includes("public.upt_can_manage_administration()"))
 assert.ok(source.includes("t.status in ('approved','locked')"))
 assert.ok(source.includes("Approved time records require correction"))
 assert.ok(source.includes("rows between unbounded preceding and 1 preceding"))
 assert.ok(source.includes("join ranked b"))
 assert.ok(!source.includes("grant execute"))
 assert.ok(!source.includes("truncate "))
 assert.ok(fixtures.includes("70:01"))
 assert.ok(fixtures.includes("65+6 first"))
})

test("payroll export contract cannot silently consume old break-deducting database",()=>{
 const oldCsv=readFileSync(new URL("../src/shared/payroll-csv.ts",import.meta.url),"utf8")
 const activeCsv=readFileSync(new URL("../../lib/administration/payroll-export.ts",import.meta.url),"utf8")
 assert.ok(source.includes("jsonb_build_object('policy_version','paid60-grace10-event-v1')"))
 assert.ok(oldCsv.includes("row.policy_version!==PAYROLL_POLICY_VERSION"))
 assert.ok(oldCsv.includes("'Deducted excess break seconds'"))
 assert.ok(oldCsv.includes("const deducted=gross-net"))
 assert.ok(oldCsv.includes("pause>gross||net>gross||gross-net>pause"))
 assert.ok(!oldCsv.includes("gross-pause!==net"))
 // The existing deployed exporter MUST retain its original matching SQL
 // contract until the real schema and candidate exporter release together.
 assert.ok(activeCsv.includes("gross-pause!==net"))
 assert.ok(!activeCsv.includes("PAYROLL_POLICY_VERSION"))
})
