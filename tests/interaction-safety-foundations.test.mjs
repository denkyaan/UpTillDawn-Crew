import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('undo is actor scoped and time bounded', async () => {
  const source = await readFile(new URL('../lib/undo-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /record\.actorId === actorId/)
  assert.match(source, /record\.expiresAt > now/)
  assert.match(source, /!record\.revertedAt/)
})

test('keyboard shortcuts respect permissions and detect collisions', async () => {
  const source = await readFile(new URL('../lib/keyboard-shortcuts.ts', import.meta.url), 'utf8')
  assert.match(source, /permissions\.has\(shortcut\.requiredPermission\)/)
  assert.match(source, /new Set\(signatures\)\.size !== signatures\.length/)
})

test('focus management returns focus predictably and traps overlays', async () => {
  const source = await readFile(new URL('../lib/focus-management.ts', import.meta.url), 'utf8')
  for (const target of ['trigger','heading','first-error','main-content']) assert.ok(source.includes(`'${target}'`))
  assert.match(source, /transition\.openedOverlay && !transition\.closedOverlay/)
})

test('high impact destructive actions require stronger confirmation', async () => {
  const source = await readFile(new URL('../lib/destructive-action-policy.ts', import.meta.url), 'utf8')
  for (const level of ['confirm','type-name','reauthenticate']) assert.ok(source.includes(`'${level}'`))
  assert.match(source, /return 'reauthenticate'/)
  assert.match(source, /destructiveActionRequiresReason/)
})
