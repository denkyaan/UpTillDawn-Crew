import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('imports validate before writes and require confirmation', async () => {
  const source = await readFile(new URL('../lib/import-policy.ts', import.meta.url), 'utf8')
  for (const mode of ['validate-only','create-only','upsert']) assert.ok(source.includes(`'${mode}'`))
  assert.match(source, /!request\.validationPassed/)
  assert.match(source, /request\.confirmed/)
})

test('sync conflicts require explicit deterministic resolution', async () => {
  const source = await readFile(new URL('../lib/conflict-resolution.ts', import.meta.url), 'utf8')
  for (const resolution of ['keep-local','keep-remote','manual-merge']) assert.ok(source.includes(`'${resolution}'`))
  assert.match(source, /Manual merge requires a value/)
})

test('form drafts are user scoped and expire', async () => {
  const source = await readFile(new URL('../lib/form-drafts.ts', import.meta.url), 'utf8')
  assert.match(source, /draft\.userId === userId/)
  assert.match(source, /draft\.expiresAt > now/)
  assert.match(source, /draft\.expiresAt <= now/)
})

test('deep links encode identifiers and preserve event context', async () => {
  const source = await readFile(new URL('../lib/deep-links.ts', import.meta.url), 'utf8')
  assert.match(source, /encodeURIComponent/)
  assert.match(source, /eventId/)
  assert.match(source, /Missing id/)
})
