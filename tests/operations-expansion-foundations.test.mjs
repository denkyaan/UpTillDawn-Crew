import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('inventory foundation tracks operational conditions and stock', async () => {
  const source = await readFile(new URL('../lib/inventory.ts', import.meta.url), 'utf8')
  for (const status of ['available','issued','damaged','missing','returned']) assert.ok(source.includes(`'${status}'`))
  assert.match(source, /availableQuantity \/ item\.totalQuantity <= 0\.2/)
  assert.match(source, /item\.availableQuantity >= quantity/)
})

test('transport foundation prevents silent capacity overflow', async () => {
  const source = await readFile(new URL('../lib/transport.ts', import.meta.url), 'utf8')
  assert.match(source, /Math\.max\(0, vehicle\.capacity - occupied\)/)
  assert.match(source, /passengerUserIds\.length > Math\.max\(0, vehicle\.capacity\)/)
})

test('document access supports role audiences and offline critical documents', async () => {
  const source = await readFile(new URL('../lib/document-access.ts', import.meta.url), 'utf8')
  for (const kind of ['briefing','safety','map','procedure','permit','technical','crew']) assert.ok(source.includes(`'${kind}'`))
  assert.match(source, /offlineCritical === true/)
})

test('emergency mode requires minimum offline-safe event information', async () => {
  const source = await readFile(new URL('../lib/emergency-mode.ts', import.meta.url), 'utf8')
  assert.match(source, /eventName\.trim\(\)/)
  assert.match(source, /eventAddress\.trim\(\)/)
  assert.match(source, /emergencyNumber\.trim\(\)/)
  assert.match(source, /uptilldawn:emergency:/)
})
