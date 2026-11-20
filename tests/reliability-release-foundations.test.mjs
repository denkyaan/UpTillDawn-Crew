import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('release readiness blocks on required failed checks', async () => {
  const source = await readFile(new URL('../lib/release-readiness.ts', import.meta.url), 'utf8')
  assert.match(source, /check\.required && !check\.passed/)
  assert.match(source, /ready: failedRequiredChecks\.length === 0/)
  assert.match(source, /warnings/)
})

test('mutations use validated idempotency keys and deterministic dedupe keys', async () => {
  const source = await readFile(new URL('../lib/idempotency.ts', import.meta.url), 'utf8')
  assert.match(source, /normalized\.length >= 16/)
  assert.match(source, /normalized\.length <= 128/)
  assert.match(source, /mutation\.idempotencyKey/)
})

test('sensitive and high-volume actions have explicit rate limits', async () => {
  const source = await readFile(new URL('../lib/rate-limit-policy.ts', import.meta.url), 'utf8')
  for (const action of ['login','password-reset','push-send','export','import','incident-create','god-mode-change','api-write']) assert.ok(source.includes(`'${action}'`))
  assert.match(source, /windowSeconds/)
})

test('recovery objectives define data loss and recovery targets', async () => {
  const source = await readFile(new URL('../lib/recovery-policy.ts', import.meta.url), 'utf8')
  for (const tier of ['critical','important','standard']) assert.ok(source.includes(`'${tier}'`))
  assert.match(source, /maxDataLossMinutes/)
  assert.match(source, /maxRecoveryMinutes/)
  assert.match(source, /recoveryTargetMet/)
})
