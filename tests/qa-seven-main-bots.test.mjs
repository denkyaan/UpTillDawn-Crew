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
