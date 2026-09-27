import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('planning rules guard overlaps, rest and occupancy', async () => {
  const source = await readFile(new URL('../lib/planning-rules.ts', import.meta.url), 'utf8')
  for (const rule of ['invalid-range','overlap','insufficient-rest','understaffed','overstaffed']) assert.ok(source.includes(`'${rule}'`))
  assert.match(source, /a\.startsAt < b\.endsAt && b\.startsAt < a\.endsAt/)
})

test('task workflow includes blocked and overdue semantics', async () => {
  const source = await readFile(new URL('../lib/task-workflow.ts', import.meta.url), 'utf8')
  for (const status of ['open','in-progress','blocked','completed','cancelled']) assert.ok(source.includes(`'${status}'`))
  assert.match(source, /dueAt < now/)
})

test('incident workflow prioritizes safety and supports escalation', async () => {
  const source = await readFile(new URL('../lib/incident-workflow.ts', import.meta.url), 'utf8')
  for (const category of ['medical','safety','security','equipment','technical','staff','general']) assert.ok(source.includes(`'${category}'`))
  assert.match(source, /urgency === 'urgent'/)
  assert.match(source, /status === 'new'/)
  assert.match(source, /escalationMinutes/)
})
