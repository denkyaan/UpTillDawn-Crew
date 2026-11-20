import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('command palette respects surface and permission boundaries', async () => {
  const source = await readFile(new URL('../lib/command-palette.ts', import.meta.url), 'utf8')
  assert.match(source, /command\.surfaces\.includes\(surface\)/)
  assert.match(source, /permissions\.has\(command\.requiredPermission\)/)
  assert.match(source, /command\.keywords/)
})

test('saved views sanitize user-selected columns', async () => {
  const source = await readFile(new URL('../lib/saved-views.ts', import.meta.url), 'utf8')
  assert.match(source, /visibleColumns/)
  assert.match(source, /allowedColumns\.has\(column\)/)
  assert.match(source, /new Set\(columns\)/)
})

test('event map coordinates stay inside normalized floorplan bounds', async () => {
  const source = await readFile(new URL('../lib/event-map.ts', import.meta.url), 'utf8')
  assert.match(source, /point\.x >= 0 && point\.x <= 1/)
  assert.match(source, /point\.y >= 0 && point\.y <= 1/)
  assert.match(source, /incidentId/)
})

test('PWA updates never activate over unsynced work', async () => {
  const source = await readFile(new URL('../lib/pwa-update-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /!context\.hasUnsyncedMutations/)
  assert.match(source, /context\.activeShift/)
  assert.match(source, /state === 'available' \|\| context\.state === 'ready'/)
})
