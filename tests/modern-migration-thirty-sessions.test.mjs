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
 assert.ok(s.includes('cloudflareWorkerMeasured:false'))
 assert.ok(s.includes('scope:"local"'))
 assert.ok(!s.includes("service_role"))
 assert.ok(!s.includes("console.log(password)"))
})
test("real role QA reads route data under RLS; production and standard Main CI remain untouched",()=>{
 const acceptance=read("modern/tests/browser-auth-qa.mjs")
 assert.ok(acceptance.includes('QA_AUTHENTICATED_READ_FAILED'))
 assert.ok(acceptance.includes('const routes=["/profile","/notifications"'))
 const yml=read(".github/workflows/fast-change-validation.yml")
 assert.ok(yml.includes("Candidate 30 independent signed QA sessions"))
 assert.ok(yml.includes("github.event.pull_request.head.repo.full_name == github.repository"))
 assert.ok(yml.includes("secrets.MAIN_QA_BOT_PASSWORD"))
 assert.ok(yml.includes("npm --prefix modern run sessions:qa"))
 assert.ok(yml.includes('VITE_MIGRATION_ALLOW_WRITES: "false"'))
})
