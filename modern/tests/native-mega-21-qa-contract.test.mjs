import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"

const file=new URL("./qa-native-mega-21-signed-http.mjs",import.meta.url)
const qa=readFileSync(file,"utf8")
const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
test("one opt-in suite covers 21 new original actions, in two signed bot contexts",()=>{
 execFileSync(process.execPath,["--check",file.pathname],{stdio:"pipe",timeout:12000})
 assert.ok(qa.includes("assert.equal(megaPeopleActionIds.length,11)"))
 assert.ok(qa.includes("assert.equal(megaOperationsActionIds.length,10)"))
 assert.ok(qa.includes("assert.equal(publicDenials,42)"))
 assert.ok(qa.includes("assert.equal(signedDenials,6)"))
 assert.ok(qa.includes("assert.equal(spoofDenials,4)"))
})
test("signed public QA is read-only; native in-process checks never perform targetless insert or mark-all",()=>{
 for(const guard of [
  "E2E_MAIN_QA_BASE_URL","E2E_MAIN_MODERN_QA_ORIGIN",
  'VITE_MIGRATION_ALLOW_WRITES!=="false"',
  'UPT_MIGRATION_ALLOW_WRITES:"true"',
  "const missing=randomUUID()",
  "assert.equal(live.status(),503",
  "assert.equal(forwards,0)",
  "Never run a targetless insert or mark-all notification on live QA"
 ])assert.ok(qa.includes(guard),"Missing signed QA protection: "+guard)
 assert.ok(workflow.includes("needs.validate-trigger.outputs.native_admin_qa_eligible == 'true'"))
 assert.ok(workflow.includes("needs.deploy-modern-main-qa.result == 'success'"))
 for(const script of [
  "qa-native-admin-signed-http.mjs",
  "qa-native-wave-two-signed-http.mjs",
  "qa-native-wave-three-signed-http.mjs",
  "qa-native-wave-four-signed-http.mjs",
  "qa-native-wave-five-signed-http.mjs",
  "qa-native-wave-six-signed-http.mjs",
  "qa-native-mega-21-signed-http.mjs"
 ])assert.ok(workflow.includes("node modern/tests/"+script),"Missing prior signed QA wave "+script)
})
