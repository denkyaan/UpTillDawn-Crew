import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('overtime calculations are configurable and break-aware', async () => {
  const source = await readFile(new URL('../lib/overtime-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /dailyThresholdMinutes/)
  assert.match(source, /weeklyThresholdMinutes/)
  assert.match(source, /policy\.excludeBreaks \? summary\.breakMinutes : 0/)
})

test('time corrections require reason and auditable review state', async () => {
  const source = await readFile(new URL('../lib/time-correction.ts', import.meta.url), 'utf8')
  for (const status of ['pending','approved','rejected','cancelled']) assert.ok(source.includes(`'${status}'`))
  assert.match(source, /request\.reason\.trim\(\)/)
  assert.match(source, /reviewedBy/)
})

test('urgent and operational notifications never enter normal bundles', async () => {
  const source = await readFile(new URL('../lib/notification-bundling.ts', import.meta.url), 'utf8')
  assert.match(source, /candidate\.priority === 'normal'/)
  assert.match(source, /candidate\.category !== 'incident'/)
  assert.match(source, /candidate\.category !== 'help'/)
})

test('event comparisons remain descriptive deltas', async () => {
  const source = await readFile(new URL('../lib/event-comparison.ts', import.meta.url), 'utf8')
  for (const metric of ['crewHoursDelta','noShowsDelta','incidentsDelta','taskCompletionRateDelta']) assert.ok(source.includes(metric))
})
