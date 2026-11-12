import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,readdirSync} from 'node:fs'

test('Main adversarial inventory discovers every route handler and reports dynamic coverage separately',()=>{
 const result=spawnSync(process.execPath,['scripts/main-adversarial-surface.mjs','--inventory-only'],{encoding:'utf8'})
 assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''))
 const inventory=JSON.parse(readFileSync('test-results/main-adversarial/inventory.json','utf8'))
 assert.ok(inventory.pages>=90, 'Unexpectedly missing UI pages')
 assert.ok(inventory.api>=50, 'Unexpectedly missing API routes')
 assert.equal(inventory.total,inventory.entries.length)
 assert.ok(inventory.entries.some(r=>r.route==='/god-mode'))
 assert.ok(inventory.entries.some(r=>r.route==='/api/error-reports'))
 assert.ok(inventory.entries.some(r=>r.route==='/api/god/sql'))
 assert.ok(inventory.entries.some(r=>r.route==='/portals/administration/modules/00000000-0000-4000-8000-00000000e2e1'&&r.isDynamic))
})

test('Main adversarial runtime probes have strict no-production and no-write gates',()=>{
 const source=readFileSync('scripts/main-adversarial-surface.mjs','utf8')
 assert.match(source,/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.doesNotMatch(source,/crew\.uptilldawn\.workers\.dev/)
 assert.match(source,/Never issues authenticated mutations/)
 assert.match(source,/Cross-origin anonymous POST unexpectedly succeeded/)
 assert.match(source,/Unauthenticated request received a successful private API response/)
 assert.match(source,/method='GET'/)
 const crawl=readFileSync('scripts/main-adversarial-auth-crawl.mjs','utf8')
 for(const role of ['admin','administration','promotion','staff','responsible','maker'])assert.match(crawl,new RegExp("role:'"+role+"'"))
 assert.match(crawl,/E2E_ALLOW_MAIN_TEST/)
 assert.match(crawl,/page\.on\('pageerror'/)
 assert.match(crawl,/dynamicPages/)
})

test('Only five approved workflows exist and Main cannot start production during QA',()=>{
 const files=readdirSync('.github/workflows').filter(p=>p.endsWith('.yml')||p.endsWith('.yaml')).sort()
 assert.deepEqual(files,[
  'ci.yml','cleanup-actions-history.yml','deploy-cloudflare.yml','deploy-main.yml','fast-change-validation.yml',
 ])
 const main=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
 const deploy=readFileSync('.github/workflows/deploy-main.yml','utf8')
 assert.match(main,/run_six_role_acceptance/)
 assert.match(main,/run: node scripts\/main-adversarial-auth-crawl\.mjs/)
 assert.match(main,/node scripts\/main-adversarial-surface\.mjs --inventory-only/)
 assert.match(deploy,/node scripts\/main-adversarial-surface\.mjs --probe/)
 assert.match(deploy,/Adversarial anonymous route and API guard probes on Main/)
})
