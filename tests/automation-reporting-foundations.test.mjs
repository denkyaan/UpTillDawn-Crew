import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('automation engine supports core operational triggers and scoped rules', async () => {
  const source = await readFile(new URL('../lib/automation-engine.ts', import.meta.url), 'utf8')
  for (const trigger of ['shift-starting','shift-started','shift-ended','task-overdue','briefing-updated','incident-created','occupancy-changed','event-phase-changed']) assert.ok(source.includes(`'${trigger}'`))
  for (const action of ['notify-user','notify-responsible','notify-admin','create-task','reset-briefing-confirmation','escalate-incident']) assert.ok(source.includes(`'${action}'`))
  assert.match(source, /rule\.enabled/)
  assert.match(source, /rule\.eventId === context\.eventId/)
})

test('event templates support selective cloning', async () => {
  const source = await readFile(new URL('../lib/event-template.ts', import.meta.url), 'utf8')
  for (const section of ['workplaces','roles','shifts','briefing','tasks','checklists','responsibles','automations']) assert.ok(source.includes(`'${section}'`))
})

test('post-event reporting includes attendance, net work and completion metrics', async () => {
  const source = await readFile(new URL('../lib/post-event-report.ts', import.meta.url), 'utf8')
  assert.match(source, /workedMinutes - input\.breakMinutes/)
  assert.match(source, /netWorkedMinutes - input\.plannedMinutes/)
  assert.match(source, /attendanceRate/)
  assert.match(source, /taskCompletionRate/)
})
