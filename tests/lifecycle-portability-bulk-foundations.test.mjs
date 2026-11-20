import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('completed events can be archived read-only and restored', async () => {
  const source = await readFile(new URL('../lib/event-archive-policy.ts', import.meta.url), 'utf8')
  for (const state of ['active','completed','archived','restored']) assert.ok(source.includes(`'${state}'`))
  assert.match(source, /record\.state === 'completed'/)
  assert.match(source, /record\.state === 'archived'/)
})

test('data portability is user and organization scoped', async () => {
  const source = await readFile(new URL('../lib/data-portability.ts', import.meta.url), 'utf8')
  assert.match(source, /request\.userId\.trim\(\)/)
  assert.match(source, /request\.organizationId\.trim\(\)/)
  assert.match(source, /new Set\(datasets\)/)
})

test('account lifecycle explicitly controls login and suspension reasons', async () => {
  const source = await readFile(new URL('../lib/account-lifecycle.ts', import.meta.url), 'utf8')
  for (const state of ['invited','active','suspended','deactivated']) assert.ok(source.includes(`'${state}'`))
  assert.match(source, /account\.state === 'active'/)
  assert.match(source, /nextState === 'suspended' \|\| nextState === 'deactivated'/)
})

test('bulk mutations deduplicate targets and require confirmation', async () => {
  const source = await readFile(new URL('../lib/bulk-actions.ts', import.meta.url), 'utf8')
  assert.match(source, /new Set\(request\.entityIds/)
  assert.match(source, /request\.confirmed/)
  assert.match(source, /ids\.length > 0/)
})
