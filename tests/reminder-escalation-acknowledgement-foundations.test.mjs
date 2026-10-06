import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('shift reminders cover pre-shift and late check-in moments', async () => {
  const source = await readFile(new URL('../lib/shift-reminders.ts', import.meta.url), 'utf8')
  for (const kind of ['day-before','hours-before','start-soon','late-check-in']) assert.ok(source.includes(`'${kind}'`))
  assert.match(source, /context\.checkedInAt/)
})

test('operational escalation routes urgent and unresolved conditions', async () => {
  const source = await readFile(new URL('../lib/escalation-policy.ts', import.meta.url), 'utf8')
  for (const type of ['late-check-in','unresolved-help','urgent-incident','unfilled-shift']) assert.ok(source.includes(`'${type}'`))
  assert.match(source, /return 'admin'/)
  assert.match(source, /return 'responsible'/)
})

test('acknowledgements are version aware and expose missing users', async () => {
  const source = await readFile(new URL('../lib/acknowledgement-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /acknowledgement\.version >= currentVersion/)
  assert.match(source, /usersMissingAcknowledgement/)
  assert.match(source, /acknowledgementCompletionRate/)
})

test('no-show detection uses explicit grace period and excuses', async () => {
  const source = await readFile(new URL('../lib/no-show-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /return 15/)
  assert.match(source, /!context\.excused/)
  assert.match(source, /shiftIsNoShow/)
})
