import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {payrollCsv as activePayrollCsv} from "../lib/administration/payroll-export.ts"
import {payrollCsv as candidatePayrollCsv,PAYROLL_POLICY_VERSION} from "../modern/src/shared/payroll-csv.ts"
const read=path=>readFileSync(path,"utf8")
const sample={
 session_id:"safe-1",event_id:"event-1",event_name:"Test",user_id:"person-1",
 full_name:"Worker",timesheet_status:"approved",started_at:"2026-11-19T08:00:00Z",
 ended_at:"2026-11-19T10:00:00Z",gross_seconds:7200,break_seconds:1800,
 net_seconds:5400
}
test("main legacy payroll stays compatible with its live unversioned database",()=>{
 const root=read("lib/administration/payroll-export.ts")
 assert.ok(root.includes("gross-pause!==net"))
 assert.ok(!root.includes("PAYROLL_POLICY_VERSION"))
 assert.ok(activePayrollCsv([sample]).includes('"1.500000"'))
 assert.throws(()=>activePayrollCsv([{...sample,net_seconds:7200}]))
})
test("versioned payroll proposal is strictly separate from the live Next exporter",()=>{
 const candidate=read("modern/src/shared/payroll-csv.ts")
 const sql=read("modern/sql/break-payroll-grace-reconciliation.candidate.sql")
 assert.ok(candidate.includes("row.policy_version!==PAYROLL_POLICY_VERSION"))
 assert.ok(candidate.includes("'Deducted excess break seconds'"))
 assert.ok(sql.includes("jsonb_build_object('policy_version','paid60-grace10-event-v1')"))
 const newRow={...sample,policy_version:PAYROLL_POLICY_VERSION,net_seconds:7200}
 assert.ok(candidatePayrollCsv([newRow]).includes('"2.000000"'))
 assert.throws(()=>candidatePayrollCsv([sample]))
})
test("source-only candidate cannot replace Main or trigger production automatically",()=>{
 const rootPkg=JSON.parse(read("package.json"))
 const candidatePkg=JSON.parse(read("modern/package.json"))
 const wrangler=JSON.parse(read("modern/wrangler.jsonc"))
 const mainCi=read(".github/workflows/fast-change-validation.yml")
 const prod=read(".github/workflows/deploy-cloudflare.yml")
 const main=read(".github/workflows/deploy-main.yml")
 const rootTs=JSON.parse(read("tsconfig.json"))
 assert.ok(rootPkg.dependencies.next)
 assert.ok(!candidatePkg.dependencies.next)
 assert.equal(rootTs.exclude.includes("modern"),true)
 assert.deepEqual(wrangler.assets.run_worker_first,["/api/*"])
 assert.equal(wrangler.workers_dev,false)
 assert.ok(read("modern/.env.example").includes("VITE_MIGRATION_ALLOW_WRITES=false"))
 assert.ok(read("modern/.env.example").includes("UPT_MIGRATION_OAUTH_ENABLED=false"))
 assert.ok(mainCi.includes("github.event_name == 'workflow_dispatch' && inputs.release_production == true"))
 assert.ok(main.includes("SOURCE_EVENT"))
 assert.ok(main.includes("SOURCE_RESULT"))
 assert.ok(!main.includes("uptilldawn-modern-candidate"))
 assert.ok(prod.includes("on:") && prod.includes("workflow_dispatch"))
 assert.ok(!prod.includes("on:\n  push:"))
 assert.ok(!read("modern/README.md").includes("Automatic cutover allowed: yes"))
})
