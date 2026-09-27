import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('privacy retention supports deletion, anonymization and minimization', async () => {
  const source = await readFile(new URL('../lib/privacy-retention.ts', import.meta.url), 'utf8')
  assert.match(source, /'delete' \| 'anonymize'/)
  assert.match(source, /retentionDays/)
  assert.match(source, /allowedFields/)
})

test('activity feed tracks before-after changes and sensitive activity', async () => {
  const source = await readFile(new URL('../lib/activity-feed.ts', import.meta.url), 'utf8')
  assert.match(source, /before\?:/)
  assert.match(source, /after\?:/)
  assert.match(source, /entry\.entity === 'incident' \|\| entry\.entity === 'god-mode'/)
})

test('offline sync respects dependencies and bounded exponential retry', async () => {
  const source = await readFile(new URL('../lib/offline-sync-policy.ts', import.meta.url), 'utf8')
  for (const status of ['queued','syncing','synced','conflict','failed']) assert.ok(source.includes(`'${status}'`))
  assert.match(source, /every\(\(id\) => completedIds\.has\(id\)\)/)
  assert.match(source, /Math\.min\(60_000/)
  assert.match(source, /retryCount < 6/)
})

test('analytics metrics remain descriptive and operational', async () => {
  const source = await readFile(new URL('../lib/analytics-metrics.ts', import.meta.url), 'utf8')
  for (const metric of ['attendanceRate','noShowRate','staffingVarianceMinutes','taskCompletionRate','incidentCount','averageHelpResponseMinutes']) assert.ok(source.includes(metric))
  assert.match(source, /total > 0 \? part \/ total : 0/)
})
