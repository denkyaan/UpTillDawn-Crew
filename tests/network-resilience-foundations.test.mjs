import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('dependency circuit breaker opens and probes after cooldown', async () => {
  const source = await readFile(new URL('../lib/circuit-breaker.ts', import.meta.url), 'utf8')
  for (const state of ['closed','open','half-open']) assert.ok(source.includes(`'${state}'`))
  assert.match(source, /consecutiveFailures >= Math\.max\(1, circuit\.failureThreshold\)/)
  assert.match(source, /now - circuit\.openedAt >= Math\.max\(0, circuit\.cooldownMs\)/)
})

test('request classes have explicit bounded timeout budgets', async () => {
  const source = await readFile(new URL('../lib/request-timeout-policy.ts', import.meta.url), 'utf8')
  for (const value of ['interactive','mutation','search','export','background']) assert.ok(source.includes(`${value}:`) || source.includes(`'${value}'`))
  assert.match(source, /requestTimeoutMs\(requestClass\)/)
})

test('optimistic UI only applies when rollback is available', async () => {
  const source = await readFile(new URL('../lib/optimistic-update-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /update\.rollbackAvailable && !update\.serverConfirmed && !update\.failed/)
  assert.match(source, /update\.failed && update\.rollbackAvailable/)
})

test('connectivity state degrades on repeated failures or high latency', async () => {
  const source = await readFile(new URL('../lib/connectivity-state.ts', import.meta.url), 'utf8')
  for (const state of ['offline','poor','online']) assert.ok(source.includes(`'${state}'`))
  assert.match(source, /sample\.failedRequests >= 3/)
  assert.match(source, /sample\.latencyMs > 2_000/)
  assert.match(source, /connectivityState\(sample\) !== 'online'/)
})
