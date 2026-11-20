import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'

const main=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
const production=readFileSync('.github/workflows/ci.yml','utf8')
const mainDeployment=readFileSync('.github/workflows/deploy-main.yml','utf8')

test('Main has no long browser acceptance or full isolated validation job',()=>{
 assert.doesNotMatch(main,/\n  browser-acceptance:/)
 assert.doesNotMatch(main,/\n  full-validation:/)
 assert.doesNotMatch(main,/run_six_role_acceptance:/)
 assert.doesNotMatch(main,/\[full-ci\]|\[qa-main\]|\[release-production\]/)
 assert.match(main,/name: Parallel lint, typecheck and unit tests/)
 assert.match(mainDeployment,/workflows: \["CI main"\]/)
})

test('All six roles are covered by the complete release validation before production deployment',()=>{
 for(const marker of ['Six-role 4-language mobile and desktop authenticated acceptance (isolated)','Run 15 concurrent authenticated browser bots','Administration subtab and portal context browser regression','Full event lifecycle release gate']){
  assert.ok(production.includes(marker),marker)
 }
 assert.match(production,/dispatch-production-deploy:/)
 assert.match(production,/github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/)
})

test('Production cannot be triggered by an ordinary Main push or commit marker',()=>{
 assert.match(main,/release_production:/)
 assert.match(main,/default: false/)
 assert.match(main,/if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.release_production == true && github\.ref == 'refs\/heads\/main' \}\}/)
 assert.doesNotMatch(main,/contains\(github\.event\.head_commit\.message/)
 assert.doesNotMatch(production,/\n\s+push:/)
 const workflows=readdirSync('.github/workflows').filter(x=>x.endsWith('.yml')||x.endsWith('.yaml'))
 assert.equal(workflows.length,5)
})
