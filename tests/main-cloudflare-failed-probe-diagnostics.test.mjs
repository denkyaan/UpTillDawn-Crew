import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const yaml=readFileSync('.github/workflows/deploy-main.yml','utf8')
const anon=yaml.slice(yaml.indexOf('  qa-main-anonymous-acceptance:'),yaml.indexOf('  qa-main-browser-acceptance:'))
const runtime=yaml.slice(yaml.indexOf('  qa-main-runtime-diagnostic:'),yaml.indexOf('  validate-trigger:'))
test('Main Worker outcomes remain mandatory and visible after failed independent anonymous route probes',()=>{
 assert.match(anon,/needs: \[validate-trigger, deploy\]/)
 assert.match(anon,/node scripts\/main-adversarial-surface\.mjs --probe/)
 assert.match(anon,/if: always\(\)/)
 assert.match(anon,/MAIN_WORKER_DEPLOYED_AT: \$\{\{ needs\.deploy\.outputs\.deployed_at \}\}/)
 assert.match(anon,/run: node scripts\/main-worker-outcomes\.mjs/)
 assert.match(runtime,/always\(\)/)
 assert.match(runtime,/needs\.deploy\.result == 'success'/)
 assert.match(runtime,/node scripts\/main-worker-outcomes\.mjs/)
 assert.match(yaml,/needs: \[validate-trigger, deploy, qa-main-anonymous-acceptance\]/)
 const metrics=readFileSync('scripts/main-worker-outcomes.mjs','utf8')
 assert.match(metrics,/CLOUDFLARE_MAIN_POST_DEPLOY/)
 assert.match(metrics,/observedFailures!==null&&observedFailures>0/)
 assert.doesNotMatch(anon,/deploy-production|ci-production/)
})
