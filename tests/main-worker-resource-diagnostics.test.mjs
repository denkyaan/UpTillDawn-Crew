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
 assert.match(workflow,/needs: \[validate-trigger, deploy, qa-main-browser-acceptance, qa-main-functional-acceptance\]/)
})
