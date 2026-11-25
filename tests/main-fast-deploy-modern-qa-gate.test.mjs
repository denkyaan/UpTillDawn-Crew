import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
const sections=workflow.split(/^  (?=[a-z][a-z0-9-]+:\s*$)/m)
const qa=sections.find(v=>v.startsWith('qa-modern-main-qa:\n'))
const candidate=sections.find(v=>v.startsWith('deploy-modern-main-qa:\n'))
const trigger=sections.find(v=>v.startsWith('validate-trigger:\n'))
test('ordinary Main deploys publish candidate and smoke without replaying all full browser cases',()=>{
 assert.ok(candidate)
 assert.ok(candidate.includes('npm --prefix modern run check'))
 assert.ok(candidate.includes('npm --prefix modern run api:test'))
 assert.ok(candidate.includes('npm --prefix modern run build'))
 assert.ok(candidate.includes('npm --prefix modern run budget'))
 assert.ok(candidate.includes('node modern/scripts/main-qa-live-smoke.mjs'))
 assert.ok(qa)
 assert.ok(qa.includes("needs.validate-trigger.outputs.modern_qa_eligible == 'true'"))
 assert.ok(qa.includes("needs.deploy-modern-main-qa.result == 'success'"))
 assert.ok(trigger.includes("[modern-main-full-qa]"))
 assert.ok(trigger.includes("echo 'modern_qa_eligible=false'"))
 assert.ok(trigger.includes("echo 'modern_qa_eligible=true'"))
 assert.ok(trigger.includes('modern_qa_eligible:'))
 assert.ok(trigger.includes('qa_eligible:'))
})
test('full 56/44 parity remains a strict opt-in release gate; production is untouched',()=>{
 assert.ok(qa)
 for(const script of [
  'npm --prefix modern run login:visual-parity',
  'npm --prefix modern run browser:qa',
  'npm --prefix modern run sessions:qa',
  'npm --prefix modern run browser:deep-qa'
 ])assert.ok(qa.includes(script),script)
 assert.ok(qa.includes('E2E_MAIN_QA_PASSWORD:'))
 assert.ok(qa.includes("VITE_MIGRATION_ALLOW_WRITES: 'false'"))
 assert.ok(candidate.includes('Main URL cutover stays BLOCKED'))
 assert.ok(trigger.includes('SOURCE_EVENT'))
 assert.ok(!qa.includes('continue-on-error: true'))
 assert.equal((qa.match(/steps\.qa_transport\.outcome == 'success'/g)||[]).length,7)
 assert.ok(qa.includes('node modern/scripts/qa-live-verdict.mjs'))
 assert.ok(qa.includes('QA_ROLES_OUTCOME:'))
 assert.ok(qa.includes('QA_SESSIONS_OUTCOME:'))
 assert.ok(qa.includes('QA_DEEP_OUTCOME:'))
 assert.ok(qa.includes('QA_FIXTURE_OUTCOME:'))
 assert.ok(qa.includes('QA_FIXTURE_CLEANUP_OUTCOME:'))
 assert.ok(!qa.includes('|| true'))
 assert.ok(!workflow.includes('deploy-cloudflare.yml/dispatches'))
})
