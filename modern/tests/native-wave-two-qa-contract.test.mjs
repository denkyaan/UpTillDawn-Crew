import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"

const script=new URL("./qa-native-wave-two-signed-http.mjs",import.meta.url)
const source=readFileSync(script,"utf8")

test("opt-in 11-action Main-QA signed suite has valid JS and is never run in fast CI",()=>{
 execFileSync(process.execPath,["--check",script.pathname],{stdio:"pipe",timeout:10000})
 assert.ok(source.includes('const cases=['))
 assert.ok(source.includes('assert.equal(cases.length,11)'))
 assert.ok(source.includes('assert.equal(liveWriteDenials,22)'))
 assert.ok(source.includes('assert.equal(signedInProcessDenials,20)'))
})
test("signed acceptance is fixed to QA only, refuses public write enablement, and never runs targetless admin writes",()=>{
 assert.ok(source.includes('E2E_MAIN_QA_BASE_URL')&&source.includes('E2E_MAIN_MODERN_QA_ORIGIN'))
 assert.ok(source.includes('VITE_MIGRATION_ALLOW_WRITES!=="false"'))
 assert.ok(source.includes('UPT_MIGRATION_ALLOW_WRITES:"true"'))
 assert.ok(source.includes('if(bot.admin&&targetlessMutation)'))
 assert.ok(source.includes('assert.equal(intentionallySkippedMutations,2)'))
 assert.ok(source.includes('assert.equal(sourceForwarding,0)'))
 assert.ok(source.includes('assert.equal(response.status(),503'))
 const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
 assert.ok(workflow.includes('node modern/tests/qa-native-wave-two-signed-http.mjs'))
 assert.ok(workflow.includes("needs.validate-trigger.outputs.native_admin_qa_eligible == 'true'"))
 assert.ok(workflow.includes("needs.deploy-modern-main-qa.result == 'success'"))
})
