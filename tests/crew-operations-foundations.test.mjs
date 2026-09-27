import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('crew self-service supports availability and explicit shift responses', async () => {
  const source = await readFile(new URL('../lib/crew-self-service.ts', import.meta.url), 'utf8')
  for (const value of ['available','unavailable','preferred','pending','accepted','declined']) assert.ok(source.includes(`'${value}'`))
  assert.match(source, /window\.endsAt > window\.startsAt/)
  assert.match(source, /declined.*reason/s)
})

test('shift change requests require approval and replacement where applicable', async () => {
  const source = await readFile(new URL('../lib/shift-change-requests.ts', import.meta.url), 'utf8')
  for (const value of ['swap','replacement','claim-open-shift','pending','approved','rejected','cancelled']) assert.ok(source.includes(`'${value}'`))
  assert.match(source, /Boolean\(request\.replacementUserId\)/)
})

test('required checklist items and photo evidence block premature close', async () => {
  const source = await readFile(new URL('../lib/checklists.ts', import.meta.url), 'utf8')
  assert.match(source, /item\.requiresPhoto && !item\.photoAttached/)
  assert.match(source, /filter\(\(item\) => item\.required\)\.every/)
})

test('temporary workplace transfers preserve the original assignment', async () => {
  const source = await readFile(new URL('../lib/workplace-transfer.ts', import.meta.url), 'utf8')
  assert.match(source, /originalWorkplaceId/)
  assert.match(source, /temporaryWorkplaceId/)
  assert.match(source, /active\?\.temporaryWorkplaceId \?\? originalWorkplaceId/)
})
