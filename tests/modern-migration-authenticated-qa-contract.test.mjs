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
test("QA browser never uses production, never blocks ordinary Main CI",()=>{
 const yml=src(".github/workflows/fast-change-validation.yml")
 assert.ok(yml.includes("Candidate authenticated seven-role browser acceptance"))
 assert.ok(yml.includes("github.event.pull_request.head.repo.full_name == github.repository"))
 assert.ok(yml.includes("secrets.MAIN_QA_BOT_PASSWORD"))
 assert.ok(yml.includes('VITE_MIGRATION_ALLOW_WRITES: "false"'))
 assert.ok(yml.includes("QA-only password secret not configured. Authenticated acceptance NOT executed."))
 assert.ok(yml.includes("npm --prefix modern run browser:qa"))
 assert.ok(!yml.includes("E2E_MAIN_QA_SERVICE_KEY"))
 const pkg=JSON.parse(src("modern/package.json"))
 assert.equal(pkg.scripts["browser:qa"],"node tests/browser-auth-qa.mjs")
})
