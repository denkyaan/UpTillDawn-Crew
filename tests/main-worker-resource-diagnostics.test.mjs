import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('scripts/main-worker-outcomes.mjs','utf8')
const workflow=readFileSync('.github/workflows/deploy-main.yml','utf8')

test('Cloudflare diagnostics distinguish resource-limit outcomes from successful invocations',()=>{
 assert.match(source,/statusCounts\.get\('exceededResources'\)/)
 assert.match(source,/statusCounts\.get\('exceededCpu'\)/)
 assert.match(source,/statusCounts\.get\('exceededMemory'\)/)
 assert.match(source,/::warning::Main Worker runtime limit exceeded/)
 assert.match(source,/statusCounts\.get/)
 assert.match(source,/last90min/)
})
test('Main-only metrics include CPU P99 and isolate-memory P99 without exposing requests or production',()=>{
 assert.match(source,/quantiles \{ cpuTimeP99 memoryUsageBytesP99 \}/)
 assert.match(source,/cpuP99MaxUs\/1000/)
 assert.match(source,/memoryP99MaxBytes\/\(1024\*1024\)/)
 assert.match(source,/Memory|memory/i)
 assert.match(source,/script:'uptilldawn-main'/)
 assert.doesNotMatch(source,/script:'uptilldawn-crew'/)
 assert.match(workflow,/qa-main-runtime-diagnostic:/)
 assert.match(workflow,/run: node scripts\/main-worker-outcomes\.mjs/)
 assert.match(workflow,/needs: \[validate-trigger, deploy, qa-main-browser-acceptance, qa-main-functional-acceptance, qa-main-concurrency-acceptance\]/)
})

test('post-deploy resource measurement cannot mistake 90-minute history for current worker health',()=>{
 assert.match(source,/MAIN_WORKER_DEPLOYED_AT/)
 assert.match(source,/CLOUDFLARE_MAIN_POST_DEPLOY/)
 assert.match(source,/deployedAt>start&&deployedAt<=now/)
 assert.match(source,/start:deployedAt\.toISOString\(\)/)
 assert.match(source,/still exceeded resource limits after current deployment/)
 assert.match(source,/if\(observedFailures!==null&&observedFailures>0\)/)
 assert.match(source,/process\.exitCode=1/)
 assert.match(source,/::error::Main Worker post-deploy 1102\/resource errors/)
 assert.match(workflow,/MAIN_WORKER_DEPLOYED_AT: \$\{\{ needs\.deploy\.outputs\.deployed_at \}\}/)
 assert.match(workflow,/deployed_at: \$\{\{ steps\.worker-deploy\.outputs\.deployed_at \}\}/)
 assert.match(workflow,/echo "deployed_at=\$\(date -u \+%Y-%m-%dT%H:%M:%SZ\)" >> "\$GITHUB_OUTPUT"/)
})

test('Cloudflare metrics cannot override a failed end-to-end browser verdict',()=>{
 assert.match(source,/MAIN_BROWSER_QA_RESULT==='failure'/)
 assert.match(source,/browser acceptance failed while analytics reported zero/)
 assert.match(workflow,/MAIN_BROWSER_QA_RESULT: \$\{\{ needs\.qa-main-browser-acceptance\.result \}\}/)
})
test('isolated runtime diagnostics can read Main outcomes without publishing or exposing credentials to forks',()=>{
 const ci=readFileSync('.github/workflows/fast-change-validation.yml','utf8')
 const step=ci.split('- name: Read isolated Main Worker runtime outcomes for diagnostic PRs')[1].split('# Candidate-only build gate.')[0]
 assert.match(step,/github.event_name == 'pull_request'/)
 assert.match(step,/startsWith\(github.head_ref, 'diagnostic\/main-runtime'\)/)
 assert.match(step,/github.event.pull_request.head.repo.full_name == github.repository/)
 assert.match(step,/run: node scripts\/main-worker-outcomes.mjs/)
 assert.doesNotMatch(step,/deploy|dispatch|console\.log/)
})
