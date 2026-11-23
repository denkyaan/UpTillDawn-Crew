import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"

const script=new URL("./qa-native-wave-six-signed-http.mjs",import.meta.url)
const source=readFileSync(script,"utf8")
const workflow=readFileSync(new URL("../../.github/workflows/deploy-main.yml",import.meta.url),"utf8")
test("sixth-wave QA script compiles, checks all ten public action IDs and only safe signed negative tests",()=>{
 execFileSync(process.execPath,["--check",script.pathname],{stdio:"pipe",timeout:12000})
 assert.ok(source.includes("assert.equal(nativeCatalogAdminActionIds.length,9)"))
 assert.ok(source.includes("assert.equal(nativeCatalogManagerActionIds.length,1)"))
 assert.ok(source.includes("assert.equal(publicDenials,20)"))
 assert.ok(source.includes("assert.equal(signedDbDenials,18)"))
 assert.ok(source.includes('name==="workplace-catalog.ts#createCatalogWorkplace"'))
 assert.ok(source.includes('name==="workplace-catalog.ts#createCatalogItem"'))
 assert.ok(source.includes("if(bot.admin&&("))
})
test("all 66 signed cases are confined to optional Main-QA workflow; deployed Worker remains read-only",()=>{
 for(const token of [
  "E2E_MAIN_QA_BASE_URL","E2E_MAIN_MODERN_QA_ORIGIN",
  'VITE_MIGRATION_ALLOW_WRITES!=="false"',
  'UPT_MIGRATION_ALLOW_WRITES:"true"',
  "const missing=randomUUID()","assert.equal(live.status(),503,",
  "assert.equal(forwards,0)"])
  assert.ok(source.includes(token),"Signed QA guard missing: "+token)
 assert.ok(workflow.includes("needs.validate-trigger.outputs.native_admin_qa_eligible == 'true'"))
 assert.ok(workflow.includes("needs.deploy-modern-main-qa.result == 'success'"))
 for(const name of [
  "qa-native-admin-signed-http.mjs",
  "qa-native-wave-two-signed-http.mjs",
  "qa-native-wave-three-signed-http.mjs",
  "qa-native-wave-four-signed-http.mjs",
  "qa-native-wave-five-signed-http.mjs",
  "qa-native-wave-six-signed-http.mjs"])
  assert.ok(workflow.includes("node modern/tests/"+name),"Missing signed QA wave "+name)
})
