import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const runner=readFileSync('scripts/e2e-main-functional-workflows.mjs','utf8')
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')

test('functional QA is confined to separate Main host and requires a private opt-in',()=>{
 assert.match(runner,/const MAIN='https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev'/)
 assert.match(runner,/const MAIN_DB='https:\/\/npbjrtiolqperdgljnhi\.supabase\.co'/)
 assert.match(runner,/E2E_MAIN_QA_ALLOW_WRITE!=='1'/)
 assert.match(runner,/!secret\|\|!password/)
 assert.doesNotMatch(runner,/eakoavcieossazqzplke/)
})
test('functional acceptance exercises real role-controlled writes and timesheet transitions',()=>{
 for(const feature of ['upt_administration_save_event_draft','event_members','event_availability','upt_submit_timesheet','upt_review_timesheet','upt_lock_timesheet','admin_artist_bookings','admin_financial_documents','admin_financial_lines']){
  assert.ok(runner.includes(feature),feature)
 }
 assert.match(runner,/await checkBrowser\(office\)/)
 assert.match(runner,/Staff cannot create invoices/)
 assert.match(runner,/Administration cannot self-approve invoice/)
})
test('fixture cleanup runs in finally and verifies the exact newly created event',()=>{
 assert.match(runner,/const prefix='UPT-QA-FUNCTION-'\+randomUUID\(\)/)
 assert.match(runner,/if\(!existing\.name\?\.startsWith\(prefix\)\|\|existing\.created_by!==created\.office\)/)
 assert.match(runner,/await remove\('timesheets'/)
 assert.match(runner,/await remove\('events'/)
 assert.match(runner,/finally\{[\s\S]*?await clean\(\)/)
 assert.match(runner,/fixtureCleaned:/)
})
test('existing approved Main deploy workflow runs functional E2E without a sixth workflow or production trigger',()=>{
 assert.match(workflow,/Main isolated functional workflow transactions with guaranteed fixture cleanup/)
 assert.match(workflow,/E2E_MAIN_QA_SERVICE_KEY: \$\{\{ secrets\.MAIN_QA_SUPABASE_SECRET_KEY \}\}/)
 assert.match(workflow,/node scripts\/e2e-main-functional-workflows\.mjs/)
 assert.match(workflow,/main-isolated-functional-e2e/)
 assert.match(workflow,/needs\.deploy\.result == 'success'/)
})

test('real functional QA has its own independent job and evidence even when browser QA fails',()=>{
 const browser=workflow.slice(workflow.indexOf('  qa-main-browser-acceptance:'),workflow.indexOf('  qa-main-functional-acceptance:'))
 const functional=workflow.slice(workflow.indexOf('  qa-main-functional-acceptance:'),workflow.indexOf('  validate-trigger:'))
 assert.doesNotMatch(browser,/node scripts\/e2e-main-functional-workflows\.mjs/)
 assert.match(functional,/needs: \[validate-trigger, deploy\]/)
 assert.match(functional,/needs\.deploy\.result == 'success'/)
 assert.match(functional,/Main isolated functional workflow transactions with guaranteed fixture cleanup/)
 assert.match(functional,/if: always\(\)/)
 assert.doesNotMatch(functional,/needs\.qa-main-browser-acceptance/)
})
