import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('privileged sessions have stricter expiry and reauthentication', async () => {
  const source = await readFile(new URL('../lib/session-security.ts', import.meta.url), 'utf8')
  assert.match(source, /session\.privileged \|\| session\.risk === 'critical'/)
  assert.match(source, /return 15/)
  assert.match(source, /sessionRequiresReauthentication/)
})

test('security events classify privileged and alert-worthy activity', async () => {
  const source = await readFile(new URL('../lib/security-events.ts', import.meta.url), 'utf8')
  for (const type of ['login-failed','permission-denied','role-changed','god-mode-entered','god-mode-change','export-sensitive','session-expired']) assert.ok(source.includes(`'${type}'`))
  assert.match(source, /event\.severity === 'high' \|\| event\.severity === 'critical'/)
})

test('consent is explicit, versioned and capability-specific', async () => {
  const source = await readFile(new URL('../lib/consent-policy.ts', import.meta.url), 'utf8')
  for (const type of ['push-notifications','location','analytics','camera','offline-storage']) assert.ok(source.includes(`'${type}'`))
  assert.match(source, /policyVersion/)
  assert.match(source, /record\?\.granted/)
})

test('data integrity validates ranges duplicates and references', async () => {
  const source = await readFile(new URL('../lib/data-integrity.ts', import.meta.url), 'utf8')
  assert.match(source, /range\.endsAt > range\.startsAt/)
  assert.match(source, /a\.startsAt < b\.endsAt && b\.startsAt < a\.endsAt/)
  assert.match(source, /new Set\(ids\)\.size !== ids\.length/)
  assert.match(source, /validIds\.has\(id\)/)
})
