import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('rapid duplicate actions are detected by actor action and entity', async () => {
  const source = await readFile(new URL('../lib/duplicate-action-guard.ts', import.meta.url), 'utf8')
  assert.match(source, /action\.actorId.*action\.action.*action\.entityId/s)
  assert.match(source, /Math\.abs\(a\.occurredAt - b\.occurredAt\)/)
  assert.match(source, /3_000/)
})

test('realtime reconnect uses bounded exponential backoff', async () => {
  const source = await readFile(new URL('../lib/realtime-reconnect.ts', import.meta.url), 'utf8')
  assert.match(source, /Math\.min\(30_000, 500 \* 2 \*\* bounded\)/)
  assert.match(source, /state\.attempts < 20/)
  assert.match(source, /realtimeConnectionIsStale/)
})

test('stale data policy distinguishes live operational and reference data', async () => {
  const source = await readFile(new URL('../lib/stale-data-policy.ts', import.meta.url), 'utf8')
  for (const value of ['live','operational','reference']) assert.ok(source.includes(`'${value}'`))
  assert.match(source, /freshness !== 'live'/)
})

test('loading policy avoids blanking cached content during refresh', async () => {
  const source = await readFile(new URL('../lib/loading-state-policy.ts', import.meta.url), 'utf8')
  for (const value of ['none','inline','skeleton','blocking']) assert.ok(source.includes(`'${value}'`))
  assert.match(source, /context\.hasCachedData && !context\.critical/)
})
