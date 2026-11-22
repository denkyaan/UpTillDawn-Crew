import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {spawnSync} from "node:child_process"

const workflow=readFileSync(".github/workflows/deploy-main.yml","utf8")
const config=JSON.parse(readFileSync("modern/wrangler.main-qa.jsonc","utf8"))
const script=readFileSync("modern/tests/qa-native-admin-signed-http.mjs","utf8")
const action=readFileSync("modern/src/api/native-admin-actions.ts","utf8")
test("narrow signed QA runs only on explicit FIRST squash subject token after deploying both Workers",()=>{
 assert.match(workflow,/native_admin_qa_eligible:.*steps\.check\.outputs\.native_admin_qa_eligible/)
 assert.match(workflow,/IFS= read -r commit_subject <<< "\$commit_message"/)
 assert.match(workflow,/\[\[ "\$commit_subject" == '\[native-admin-http-qa\]' \|\| "\$commit_subject" == '\[native-admin-http-qa\] '\* \]\]/)
 assert.match(workflow,/needs\.validate-trigger\.outputs\.native_admin_qa_eligible == 'true'/)
 assert.match(workflow,/needs\.deploy\.result == 'success'/)
 assert.match(workflow,/needs\.deploy-modern-main-qa\.result == 'success'/)
 assert.match(workflow,/ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
 assert.equal((workflow.match(/^  qa-native-admin-http:$/gm)||[]).length,1)
})
test("focused signed HTTP QA script compiles before any credentialed job may run",()=>{
 const result=spawnSync(process.execPath,["--check","modern/tests/qa-native-admin-signed-http.mjs"],{
  encoding:"utf8",timeout:10000
 })
 assert.equal(result.status,0,result.stderr||"Native action QA script syntax invalid")
})
test("a scoped QA-only job never changes production, Main UI, or deployed write switches",()=>{
 assert.equal(config.vars.UPT_MIGRATION_ALLOW_WRITES,"false")
 assert.match(workflow,/VITE_MIGRATION_ALLOW_WRITES: 'false'/)
 assert.doesNotMatch(workflow,/VITE_MIGRATION_ALLOW_WRITES: 'true'/)
 assert.match(workflow,/E2E_MAIN_QA_PASSWORD: \$\{\{ secrets\.MAIN_QA_BOT_PASSWORD \}\}/)
 assert.ok(!script.includes("MAIN_QA_SUPABASE_SECRET_KEY"))
 assert.ok(!script.includes("SERVICE_ROLE_KEY"))
 assert.match(script,/UPT_MIGRATION_ALLOW_WRITES:"true"/)
 assert.match(script,/sourceReadSession/)
 assert.match(script,/migration_writes_disabled/)
 assert.match(script,/fakeId=randomUUID\(\)/)
 assert.match(script,/assert\.equal\(forwards,0/)
 assert.match(script,/originalMainFailClosedParitySamples/)
 assert.match(script,/fullVisualOrProductionParityVerified:false/)
 assert.match(script,/publicWritesEnabled:false/)
 // The original signed QA remains the exact 12 first-wave actions, not
 // the five additional disabled platform actions introduced afterward.
 const firstWaveIds=action.split("export const nativeAdminActionIds=[")[1].split("] as const")[0]
 const firstWaveCases=action.split("switch(id){")[1].split('case "lib/actions/platform.ts#setFeatureRollout"')[0]
 const matches=/"lib\/actions\/(?:guestlist|sales|platform)\.ts#[A-Za-z]+"/g
 assert.equal((firstWaveIds.match(matches)||[]).length,12)
 assert.equal((firstWaveCases.match(matches)||[]).length,12)
})
