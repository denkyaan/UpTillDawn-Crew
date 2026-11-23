import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const src=p=>readFileSync(p,"utf8")
test("only exact isolated Main QA URL and seven known bot roles can authenticate",()=>{
 const harness=src("modern/tests/browser-auth-qa.mjs")
 assert.match(harness,/qa.origin!==['"]https:\/\/npbjrtiolqperdgljnhi.supabase.co['"]/)
 assert.ok(harness.includes('if(password.length<24)throw'))
 assert.match(harness,/VITE_MIGRATION_ALLOW_WRITES!==['"]false['"]/)
 assert.ok(harness.includes("if(signins!==7||total!==56)"))
 assert.equal((harness.match(/e2e-[a-z-]+@uptilldawn\.test/g)||[]).length,7)
 assert.ok(!harness.includes("service_role"))
 assert.ok(!harness.includes("auth.admin"))
})
test("QA browser scenarios reuse in-memory login state and do not disclose secrets",()=>{
 const code=src("modern/tests/browser-auth-qa.mjs")
 assert.ok(code.includes("state=await login.storageState()"))
 assert.ok(code.includes("storageState:state"))



 assert.ok(!code.includes("storageState({path:"))
 assert.ok(!code.includes("console.log(password)"))
 assert.ok(code.includes('formsSubmitted:false,fullVisualParityVerified:false,productionReady:false'))
 assert.ok(code.includes('await compare(a,b,label)'))
 assert.ok(code.includes('await menus(a,b,label)'))
})
test("QA browser is an explicitly opted-in QA-only gate, never part of fast Main CI",()=>{
 const fast=src(".github/workflows/fast-change-validation.yml")
 const deploy=src(".github/workflows/deploy-main.yml")
 assert.ok(!fast.includes("Candidate authenticated seven-role browser acceptance"))
 assert.ok(!fast.includes("npm --prefix modern run browser:qa"))
 assert.ok(!fast.includes("secrets.MAIN_QA_BOT_PASSWORD"))
 assert.ok(deploy.includes("qa-modern-main-qa:"))
 assert.ok(deploy.includes("needs.validate-trigger.outputs.modern_qa_eligible == 'true'"))
 assert.ok(deploy.includes("E2E_MAIN_QA_PASSWORD: ${{ secrets.MAIN_QA_BOT_PASSWORD }}"))
 assert.ok(deploy.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(deploy.includes("npm --prefix modern run browser:qa"))
 assert.ok(!deploy.includes("E2E_MAIN_QA_SERVICE_KEY"))
 const pkg=JSON.parse(src("modern/package.json"))
 assert.equal(pkg.scripts["browser:qa"],"node tests/browser-auth-qa.mjs")
})
