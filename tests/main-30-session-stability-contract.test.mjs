import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync('scripts/main-30-session-stability.mjs','utf8')
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')

test('retained legacy 30-tab harness is isolated to Main and reuses only existing QA bots',()=>{
 assert.match(source,/const BASE='https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev'/)
 assert.match(source,/process\.env\.E2E_MAIN_QA_BASE_URL!==BASE/)
 assert.match(source,/const TARGET_SESSIONS=30/)
 assert.match(source,/const HOLD_MS=65_000/)
 assert.match(source,/const signedIn=\[\]/)
 assert.match(source,/const page=i<signedIn\.length\?signed\.page:await signed\.context\.newPage\(\)/)
 assert.match(source,/assert\.equal\(tabs\.length,30\)/)
 assert.match(source,/assert\.equal\(results\.length,TARGET_SESSIONS/)
 assert.doesNotMatch(source,/supabase\.auth\.admin\.createUser|service_role|serviceRole|\.insert\(|\.update\(|\.delete\(/)
 assert.doesNotMatch(source,/uptilldawn-crew\.workers\.dev/)
})
test('concurrent browser QA runs after browser/functional QA, before Worker post-deploy analytics',()=>{
 assert.match(workflow,/qa-main-concurrency-acceptance:/)
 assert.match(workflow,/needs: \[validate-trigger, deploy, qa-main-functional-acceptance, qa-main-browser-acceptance\]/)
 assert.match(workflow,/run: node scripts\/main-30-distinct-staff\.mjs/)
 assert.match(workflow,/qa-main-browser-acceptance, qa-main-functional-acceptance, qa-main-concurrency-acceptance/)
 assert.match(workflow,/MAIN_WORKER_DEPLOYED_AT:/)
})
