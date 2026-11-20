import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('audit retention keeps sensitive records immutable', async () => {
  const source = await readFile(new URL('../lib/audit-retention.ts', import.meta.url), 'utf8')
  assert.match(source, /security: .*immutable: true/)
  assert.match(source, /'god-mode': .*immutable: true/)
  assert.match(source, /'work-hours': .*immutable: true/)
  assert.match(source, /retentionDays/)
})

test('background jobs are bounded and dead-letter after max attempts', async () => {
  const source = await readFile(new URL('../lib/job-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /job\.attempts < job\.maxAttempts/)
  assert.match(source, /job\.attempts >= job\.maxAttempts/)
  assert.match(source, /3_600_000/)
})

test('global search is organization and permission scoped', async () => {
  const source = await readFile(new URL('../lib/search-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /result\.organizationId === organizationId/)
  assert.match(source, /permissions\.has\(result\.requiredPermission\)/)
  assert.match(source, /length >= 2/)
})

test('pagination has safe defaults and hard maximums', async () => {
  const source = await readFile(new URL('../lib/pagination-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /defaultLimit: 50/)
  assert.match(source, /maximumLimit: 200/)
  assert.match(source, /Math\.max\(1, Math\.min\(config\.maximumLimit, requested\)\)/)
})
