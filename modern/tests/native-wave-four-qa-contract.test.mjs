import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"

const path=new URL("./qa-native-wave-four-signed-http.mjs",import.meta.url)
const source=readFileSync(path,"utf8")
const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")

test("fourth-wave opt-in signed QA has valid JS and 14 original action IDs",()=>{
 execFileSync(process.execPath,["--check",path.pathname],{stdio:"pipe",timeout:12000})
 assert.ok(source.includes('assert.equal(nativeInventoryManagerActionIds.length,11)'))
 assert.ok(source.includes('assert.equal(nativeInventoryMemberActionIds.length,3)'))
 assert.ok(source.includes('assert.equal(publicDenials,28)'))
 assert.ok(source.includes('assert.equal(signedDbDenials,28)'))
})
test("Main-QA signed inventory acceptance is opt-in, uses only synthetic UUIDs and blocks live writes",()=>{
 assert.ok(source.includes('E2E_MAIN_QA_BASE_URL'))
 assert.ok(source.includes('E2E_MAIN_MODERN_QA_ORIGIN'))
 assert.ok(source.includes('VITE_MIGRATION_ALLOW_WRITES!=="false"'))
 assert.ok(source.includes('UPT_MIGRATION_ALLOW_WRITES:"true"'))
 assert.ok(source.includes("const missing=randomUUID()"))
 assert.ok(source.includes('assert.equal(live.status(),503'))
 assert.ok(source.includes('assert.equal(forwards,0)'))
 assert.ok(workflow.includes("needs.validate-trigger.outputs.native_admin_qa_eligible == 'true'"))
 assert.ok(workflow.includes("needs.deploy-modern-main-qa.result == 'success'"))
 for(const name of ['qa-native-admin-signed-http.mjs','qa-native-wave-two-signed-http.mjs',
  'qa-native-wave-three-signed-http.mjs','qa-native-wave-four-signed-http.mjs'])
  assert.ok(workflow.includes("node modern/tests/"+name),"missing signed QA wave "+name)
})
