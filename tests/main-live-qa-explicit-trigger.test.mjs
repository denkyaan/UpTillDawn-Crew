import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const source=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
const job=source.split('\n  browser-acceptance:\n')[1]
assert.ok(job,'Main QA job missing')

test('Main live browser QA accepts only deliberate workflow dispatch or explicit [qa-main] marker',()=>{
 assert.match(job,/github\.event_name == 'workflow_dispatch' && inputs\.run_six_role_acceptance == true && github\.ref == 'refs\/heads\/main'/)
 assert.match(job,/github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && contains\(github\.event\.head_commit\.message, '\[qa-main\]'\)/)
 assert.match(job,/E2E_BASE_URL: https:\/\/uptilldawn-main\.uptilldawn\.workers\.dev/)
 assert.match(job,/E2E_ALLOW_MAIN_TEST: '1'/)
 assert.doesNotMatch(job,/release_production|production-current|crew\.uptilldawn\.workers\.dev/)
})

test('Live QA uses six isolated identities and strict fail-fast checks',()=>{
 for(const role of ['ADMIN','ADMINISTRATION','PROMOTION','STAFF','RESPONSIBLE','MAKER']){
  assert.match(job,new RegExp('E2E_'+role+'_EMAIL:'))
  assert.match(job,new RegExp('E2E_'+role+'_PASSWORD:'))
 }
 assert.match(job,/Missing dedicated main-test QA secret/)
 assert.match(job,/npm run e2e:portals/)
 assert.match(job,/node scripts\/main-adversarial-auth-crawl\.mjs/)
 assert.match(job,/Upload QA screenshots and structured result/)
})

test('Normal main pushes cannot opt into production release through a QA tag',()=>{
 const prod=source.split('\n  release-production:\n')[1].split('\n  browser-acceptance:\n')[0]
 assert.match(prod,/contains\(github\.event\.head_commit\.message, '\[release-production\]'\)/)
 assert.doesNotMatch(prod,/\[qa-main\]/)
 const workflows=readdirSync('.github/workflows').filter(x=>x.endsWith('.yml')||x.endsWith('.yaml'))
 assert.equal(workflows.length,5)
})
