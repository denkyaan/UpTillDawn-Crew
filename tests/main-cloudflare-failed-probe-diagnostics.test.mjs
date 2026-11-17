import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const yaml=readFileSync('.github/workflows/deploy-main.yml','utf8')
const start=yaml.indexOf('      - name: Adversarial anonymous route and API guard probes on Main')
const end=yaml.indexOf('      - name: Publish Main adversarial route evidence',start)
test('actual Main Worker post-deploy metrics are collected even after anonymous route probe fails',()=>{
 assert.ok(start>0&&end>start,'Unexpected Main workflow ordering')
 const section=yaml.slice(start,end)
 assert.match(section,/run: node scripts\/main-adversarial-surface\.mjs --probe/)
 assert.match(section,/if: always\(\) && steps\.worker-deploy\.outcome == 'success'/)
 assert.match(section,/MAIN_WORKER_DEPLOYED_AT: \$\{\{ steps\.worker-deploy\.outputs\.deployed_at \}\}/)
 assert.match(section,/run: node scripts\/main-worker-outcomes\.mjs/)
 const metricScript=readFileSync('scripts/main-worker-outcomes.mjs','utf8')
 assert.match(metricScript,/CLOUDFLARE_MAIN_POST_DEPLOY/)
 assert.match(metricScript,/observedFailures!==null&&observedFailures>0/)
 assert.doesNotMatch(section,/production|deploy-production|ci-production/)
})
