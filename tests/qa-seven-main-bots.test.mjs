import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const script='scripts/provision-seven-main-bots.mjs'
const source=readFileSync(script,'utf8')

test('Main QA seven-bot inventory is fixed, distinct, non-Owner and isolated',()=>{
 const run=spawnSync(process.execPath,[script,'--plan'],{encoding:'utf8'})
 assert.equal(run.status,0,run.stderr)
 const bots=JSON.parse(run.stdout.split('PLAN: seven isolated QA roles ')[1].trim())
 assert.equal(bots.length,7)
 assert.deepEqual(bots.map(x=>x.key),['head_admin','left_hand','right_hand','responsible','staff','promotion','administration'])
 assert.equal(new Set(bots.map(x=>x.email)).size,7)
 assert.ok(bots.every(x=>x.email.startsWith('e2e-')&&x.email.endsWith('@uptilldawn.test')))
 assert.ok(bots.every(x=>x.role!=='owner'&&x.role!=='maker'))
 assert.equal(bots.find(x=>x.key==='head_admin')?.leadership,'head')
 assert.equal(bots.find(x=>x.key==='left_hand')?.portal,'administration')
 assert.equal(bots.find(x=>x.key==='right_hand')?.portal,'administration')
 assert.match(source,/if\(verifyOnly\)/)
 assert.match(source,/occupant!==known\.get\(bot\.email\)/)
 assert.match(source,/target\.hostname!==QA_MAIN_HOST/)
 assert.match(source,/process\.env\.UPT_QA_ALLOW_MAIN_SEED!=='1'/)
 assert.doesNotMatch(source,/from\(['"]auth\.users/)
 assert.doesNotMatch(source,/console\.log\([^\n]*password/)
})
test('bot provisioning fails closed without explicit Main-test authorization',()=>{
 const run=spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,UPT_QA_ALLOW_MAIN_SEED:'0',BOT_SERVICE_ROLE_KEY:'',BOT_TEST_PASSWORD:''}})
 assert.notEqual(run.status,0)
 assert.match(run.stderr,/Main-test QA seeding is disabled/)
})

test('Manual seven-role provisioning is isolated and never deploys Main or production',()=>{
 const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
 assert.match(workflow,/provision_qa_bots:/)
 assert.match(workflow,/provision-qa-bots:/)
 assert.match(workflow,/secrets\.MAIN_QA_SUPABASE_SECRET_KEY/)
 assert.match(workflow,/secrets\.MAIN_QA_BOT_PASSWORD/)
 assert.match(workflow,/if: github\.event_name == 'workflow_run'/)
 assert.match(workflow,/scripts\/provision-seven-main-bots\.mjs --verify/)
 assert.doesNotMatch(source,/https:\/\/eakoavcieossazqzplke\.supabase\.co/)
 assert.match(readFileSync('scripts/seed-local-maker-e2e.mjs','utf8'),/Maker QA identity can only be created on local Supabase port 54321/)
})

test('manual Main QA password sync is explicitly scoped to the seven fixed QA identities and verified by real Auth login',()=>{
 const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')
 assert.match(workflow,/provision_qa_bots:/)
 assert.match(workflow,/github\.event_name == 'workflow_dispatch'/)
 assert.match(workflow,/scripts\/provision-seven-main-bots\.mjs --sync-passwords/)
 assert.match(workflow,/scripts\/provision-seven-main-bots\.mjs --verify --verify-passwords/)
 assert.match(workflow,/secrets\.MAIN_QA_BOT_PASSWORD/)
 assert.match(source,/const syncPasswords=process\.argv\.includes\('--sync-passwords'\)/)
 assert.match(source,/const verifyPasswords=process\.argv\.includes\('--verify-passwords'\)/)
 assert.match(source,/auth\.admin\.updateUserById\(id,\{password\}\)/)
 assert.match(source,/auth\.admin\.getUserById\(id\)/)
 assert.match(source,/client\.auth\.signInWithPassword/)
 assert.match(source,/client\.auth\.getUser\(\)/)
 assert.match(source,/client\.auth\.signOut\(\)/)
 assert.match(source,/legacy\.has\(bot\.email\)/)
 assert.doesNotMatch(source,/from\(['"]auth\.users/)
 assert.doesNotMatch(source,/https:\/\/eakoavcieossazqzplke\.supabase\.co/)
})
test('QA password synchronization fails closed when Main-only authorization is absent',()=>{
 const result=spawnSync(process.execPath,[script,'--sync-passwords'],{
  encoding:'utf8',env:{...process.env,UPT_QA_ALLOW_MAIN_SEED:'0',BOT_TEST_PASSWORD:'',BOT_SERVICE_ROLE_KEY:''}
 })
 assert.notEqual(result.status,0)
 assert.match(result.stderr,/Main-test QA seeding is disabled/)
})
