import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const read=p=>readFileSync(p,"utf8")
test("candidate load gate proves thirty unique signed sessions, not thirty reused cookies",()=>{
 const s=read("modern/tests/qa-30-sessions.mjs")
 assert.ok(s.includes('sessionIds.has(payload.session_id)'))
 assert.ok(s.includes('if(sessionIds.size!==30)'))
 assert.ok(s.includes('for(let i=0;i<30;i++)'))
 assert.ok(s.includes('for(const size of [6,12,30])'))
 assert.ok(s.includes('Promise.all(sessions.slice(0,size).map(checkSession))'))
 assert.ok(s.includes("businessWrites:0,productionReady:false"))
 assert.ok(s.includes('cloudflareWorkerMeasured:Boolean(remoteWorker)'))
 assert.ok(s.includes('const remoteWorker=process.env.E2E_MAIN_MODERN_QA_ORIGIN||""'))
 assert.ok(s.includes('if(remoteWorker){'))
 assert.ok(s.includes('response.status!==200'))
 assert.ok(s.includes('record.client.rpc("upt_current_session_context")'))
 // The prior read-only Supabase-only mode is preserved and cannot claim
 // Cloudflare load evidence without explicitly selecting exact Main QA origin.
 assert.ok(s.includes('EXACT_MODERN_MAIN_QA_WORKER_REQUIRED'))
 assert.ok(s.includes('scope:"local"'))
 assert.ok(!s.includes("service_role"))
 assert.ok(!s.includes("console.log(password)"))
})
test("real role QA reads routes under RLS in opt-in QA; fast Main and production remain untouched",()=>{
 const acceptance=read("modern/tests/browser-auth-qa.mjs")
 assert.ok(acceptance.includes('ORIGINAL_VIEW_RENDER_FAILED'))
 assert.ok(acceptance.includes("['/settings','/notifications','/events','/crew']"))
 const fast=read(".github/workflows/fast-change-validation.yml")
 const deploy=read(".github/workflows/deploy-main.yml")
 assert.ok(!fast.includes("Candidate 30 independent signed QA sessions"))
 assert.ok(!fast.includes("npm --prefix modern run sessions:qa"))
 assert.ok(deploy.includes("qa-modern-main-qa:"))
 assert.ok(deploy.includes("needs.validate-trigger.outputs.modern_qa_eligible == 'true'"))
 assert.ok(deploy.includes("E2E_MAIN_QA_PASSWORD: ${{ secrets.MAIN_QA_BOT_PASSWORD }}"))
 assert.ok(deploy.includes("npm --prefix modern run sessions:qa"))
 assert.ok(deploy.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
})
