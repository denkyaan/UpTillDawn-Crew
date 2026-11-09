import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('full browser acceptance has a reproducible, pinned Playwright runtime',async()=>{
 const pkg=JSON.parse(read('package.json'))
 const lock=JSON.parse(read('package-lock.json'))
 assert.equal(pkg.devDependencies.playwright,'1.65.0')
 assert.equal(lock.packages[''].devDependencies.playwright,'1.65.0')
 assert.equal(lock.packages['node_modules/playwright'].version,'1.65.0')
 assert.equal(lock.packages['node_modules/playwright-core'].version,'1.65.0')
 assert.equal(pkg.scripts['e2e:portals'],'node scripts/e2e-all-portals.mjs')
 const {chromium}=await import('playwright')
 assert.equal(typeof chromium.launch,'function')
})
test('authenticated browser QA is opt-in, isolated and cannot release to production',()=>{
 const workflow=read('.github/workflows/fast-change-validation.yml')
 const runner=read('scripts/e2e-all-portals.mjs')
 assert.match(workflow,/run_six_role_acceptance:/)
 assert.match(workflow,/inputs\.run_six_role_acceptance == true/)
 assert.match(workflow,/npx playwright install --with-deps chromium/)
 assert.match(workflow,/npm run e2e:portals/)
 assert.match(workflow,/E2E_BASE_URL: https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev/)
 for(const key of ['ADMIN','ADMINISTRATION','PROMOTION','STAFF','RESPONSIBLE','MAKER'])
  for(const suffix of ['EMAIL','PASSWORD'])
   assert.ok(workflow.includes('secrets.E2E_'+key+'_'+suffix),'Missing QA secret binding '+key+'_'+suffix)
 assert.match(runner,/E2E_ALLOW_MAIN_TEST/)
 assert.match(runner,/const main=base\.hostname==='uptilldawn-main\.uptilldawn\.workers\.dev'/)
 assert.match(runner,/Missing|BLOCKED/)
 assert.doesNotMatch(workflow,/secrets\.SUPABASE_SERVICE_ROLE|BOT_SERVICE_ROLE_KEY/)
})

test('destructive browser fixture seeding is denied outside isolated main test',()=>{
 const seed=read('scripts/seed-15-bot-users.mjs')
 assert.match(seed,/const expectedTestHost = 'npbjrtiolqperdgljnhi\.supabase\.co'/)
 assert.match(seed,/suppliedHost !== expectedTestHost/)
 assert.match(seed,/process\.env\.UPT_QA_ALLOW_MAIN_SEED !== '1'/)
 assert.match(seed,/process\.exit\(2\)/)
 const workflows=read('.github/workflows/fast-change-validation.yml')
 assert.doesNotMatch(workflows,/node scripts\/seed-15-bot-users\.mjs/)
})
