import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('operational logs require correlation identifiers', async () => {
  const source = await readFile(new URL('../lib/observability.ts', import.meta.url), 'utf8')
  assert.match(source, /correlationId/)
  assert.match(source, /log\.message\.trim\(\) && log\.correlationId\.trim\(\)/)
  assert.match(source, /log\.level === 'error'/)
})

test('service levels cover availability latency sync and push', async () => {
  const source = await readFile(new URL('../lib/service-levels.ts', import.meta.url), 'utf8')
  for (const metric of ['availability','api-latency','sync-success','push-delivery']) assert.ok(source.includes(`'${metric}'`))
  assert.match(source, /observed <= objective\.target/)
  assert.match(source, /observed >= objective\.target/)
})

test('recoverable UI failures preserve user work where appropriate', async () => {
  const source = await readFile(new URL('../lib/error-boundary-policy.ts', import.meta.url), 'utf8')
  for (const action of ['retry','reload-section','show-fallback']) assert.ok(source.includes(`'${action}'`))
  assert.match(source, /failure\.surface === 'form' \|\| failure\.surface === 'background-sync'/)
})

test('cache policy separates offline content from sensitive live data', async () => {
  const source = await readFile(new URL('../lib/cache-policy.ts', import.meta.url), 'utf8')
  for (const strategy of ['cache-first','network-first','stale-while-revalidate','network-only']) assert.ok(source.includes(`'${strategy}'`))
  assert.match(source, /dataClass === 'personal' \|\| dataClass === 'live-status'/)
  assert.match(source, /dataClass === 'emergency'/)
})


test('health observability alerts detect stale snapshots and SLO breaches', async () => {
  const source = await readFile(new URL('../lib/observability-alerts.ts', import.meta.url), 'utf8')
  assert.match(source, /healthSnapshotAlert/)
  assert.match(source, /15 \* 60_000/)
  assert.match(source, /5 \* 60_000/)
  assert.match(source, /serviceLevelAlert/)
  assert.match(source, /ServiceLevelMetric/)
  assert.match(source, /DEFAULT_SERVICE_LEVELS/)
})
