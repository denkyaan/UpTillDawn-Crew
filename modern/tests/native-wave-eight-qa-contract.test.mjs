import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"
const path=new URL("./qa-native-wave-eight-signed-http.mjs",import.meta.url)
const qa=readFileSync(path,"utf8")
const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
test("eighth signed QA script is valid and exactly covers 11 crew + 4 Maker actions",()=>{
 execFileSync(process.execPath,["--check",path.pathname],{stdio:"pipe",timeout:15000})
 assert.ok(qa.includes("assert.equal(megaCrewEventActionIds.length,11)"))
 assert.ok(qa.includes("assert.equal(megaMakerActionIds.length,4)"))
 assert.ok(qa.includes("assert.equal(publicDenials,30)"))
 assert.ok(qa.includes("assert.equal(signedDenials,12)"))
 assert.ok(qa.includes("assert.equal(ownerDenials,6)"))
})
test("main QA signs in only two fixed bots; public write blocker is never relaxed",()=>{
 for(const guard of [
  "E2E_MAIN_QA_BASE_URL","E2E_MAIN_MODERN_QA_ORIGIN",
  'VITE_MIGRATION_ALLOW_WRITES!=="false"',
  'UPT_MIGRATION_ALLOW_WRITES:"true"',
  "const missing=randomUUID()",
  "assert.equal(response.status(),503",
  "assert.equal(forwards,0)",
  "no in-process creation, role changes"
 ])assert.ok(qa.includes(guard),"Missing eight-wave safety guard: "+guard)
 assert.ok(workflow.includes("needs.validate-trigger.outputs.native_admin_qa_eligible == 'true'"))
 assert.ok(workflow.includes("needs.deploy-modern-main-qa.result == 'success'"))
 for(const file of [
  "qa-native-admin-signed-http.mjs",
  "qa-native-wave-two-signed-http.mjs",
  "qa-native-wave-three-signed-http.mjs",
  "qa-native-wave-four-signed-http.mjs",
  "qa-native-wave-five-signed-http.mjs",
  "qa-native-wave-six-signed-http.mjs",
  "qa-native-mega-21-signed-http.mjs",
  "qa-native-wave-eight-signed-http.mjs"
 ])assert.ok(workflow.includes("node modern/tests/"+file),"Missing previous QA "+file)
})
