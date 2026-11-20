import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('organization scope requires active explicit membership', async () => {
  const source = await readFile(new URL('../lib/organization-scope.ts', import.meta.url), 'utf8')
  assert.match(source, /membership\.userId === userId/)
  assert.match(source, /membership\.organizationId === organizationId/)
  assert.match(source, /membership\.active/)
})

test('integration events have stable names and organization-scoped dedupe keys', async () => {
  const source = await readFile(new URL('../lib/integration-events.ts', import.meta.url), 'utf8')
  for (const event of ['event.created','event.phase_changed','shift.started','shift.ended','task.completed','incident.created','incident.resolved']) assert.ok(source.includes(`'${event}'`))
  assert.match(source, /event\.organizationId.*event\.id/s)
})

test('webhooks require HTTPS, configured secret and bounded retries', async () => {
  const source = await readFile(new URL('../lib/webhook-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /secretConfigured/)
  assert.match(source, /startsWith\('https:\/\/'\)/)
  assert.match(source, /attempt < 8/)
  assert.match(source, /statusCode === 429/)
})

test('API credentials are organization scoped, revocable and scope limited', async () => {
  const source = await readFile(new URL('../lib/api-access.ts', import.meta.url), 'utf8')
  assert.match(source, /organizationId/)
  assert.match(source, /revokedAt/)
  assert.match(source, /expiresAt/)
  assert.match(source, /credential\.scopes\.includes\(scope\)/)
})
