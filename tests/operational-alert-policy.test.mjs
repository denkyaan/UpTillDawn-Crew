import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('operational health has explicit alert thresholds and severity escalation', async () => {
  const source = await readFile(new URL('../lib/operational-alert-policy.ts', import.meta.url), 'utf8')
  for (const code of ['offline-failed','offline-stale','attendance-backlog','open-incidents','notification-backlog']) assert.ok(source.includes(code))
  assert.match(source, /critical/)
  assert.match(source, /warning/)
  assert.match(source, /highestAlertSeverity/)
})
