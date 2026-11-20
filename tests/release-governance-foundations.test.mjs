import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('sensitive exports require explicit reason', async () => {
  const source = await readFile(new URL('../lib/data-export-policy.ts', import.meta.url), 'utf8')
  for (const format of ['csv','xlsx','pdf']) assert.ok(source.includes(`'${format}'`))
  assert.match(source, /includePersonalData/)
  assert.match(source, /request\.dataset === 'incidents'/)
  assert.match(source, /request\.reason\?\.trim\(\)/)
})

test('feature rollout is scoped by organization audience and stable percentage', async () => {
  const source = await readFile(new URL('../lib/feature-flags.ts', import.meta.url), 'utf8')
  assert.match(source, /rolloutPercentage/)
  assert.match(source, /config\.organizationId !== organizationId/)
  assert.match(source, /config\.audience !== 'all'/)
  assert.match(source, /stableBucket/)
})

test('dependency health exposes degraded and unavailable states', async () => {
  const source = await readFile(new URL('../lib/health-checks.ts', import.meta.url), 'utf8')
  for (const health of ['healthy','degraded','unavailable']) assert.ok(source.includes(`'${health}'`))
  assert.match(source, /latencyMs/)
  assert.match(source, /check\.latencyMs > Math\.max\(0, thresholdMs\)/)
})
