import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('handover requires ready state and incoming responsible', async () => {
  const source = await readFile(new URL('../lib/shift-handover.ts', import.meta.url), 'utf8')
  assert.match(source, /handover\.status === 'ready'/)
  assert.match(source, /incomingResponsibleId/)
  assert.match(source, /openTaskIds\.length > 0 \|\| handover\.openIncidentIds\.length > 0/)
})

test('kiosk policy explicitly forbids sensitive data exposure', async () => {
  const source = await readFile(new URL('../lib/kiosk-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /exposeSensitiveData: false/)
  for (const capability of ['qr-check-in','crew-search','workplace-display','badge-print']) assert.ok(source.includes(`'${capability}'`))
})

test('imports require a clean preview before commit', async () => {
  const source = await readFile(new URL('../lib/import-validation.ts', import.meta.url), 'utf8')
  for (const entity of ['staff','shifts','workplaces','planning','inventory']) assert.ok(source.includes(`'${entity}'`))
  assert.match(source, /canCommit: rows\.length > 0 && invalidCount === 0/)
})

test('global search supports field filters and normalized text', async () => {
  const source = await readFile(new URL('../lib/global-search.ts', import.meta.url), 'utf8')
  for (const entity of ['staff','event','workplace','shift','task','incident','document']) assert.ok(source.includes(`'${entity}'`))
  assert.match(source, /token\.indexOf\(':'\)/)
  assert.match(source, /normalize\('NFKD'\)/)
})
