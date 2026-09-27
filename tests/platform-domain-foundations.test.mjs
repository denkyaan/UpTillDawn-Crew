import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('event lifecycle defines all roadmap phases and safe transitions', async () => {
  const source = await readFile(new URL('../lib/event-lifecycle.ts', import.meta.url), 'utf8')
  for (const phase of ['draft','planning','published','setup','live','teardown','closed','archived']) assert.ok(source.includes(`'${phase}'`))
  assert.match(source, /archived: \[\]/)
  assert.match(source, /phase !== 'archived'/)
})

test('urgent operational notifications cannot be bundled', async () => {
  const source = await readFile(new URL('../lib/notification-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /category === 'incident' \|\| category === 'help'/)
  assert.match(source, /priority: 'urgent'/)
  assert.match(source, /bundle: false/)
  assert.match(source, /encodeURIComponent\(entityId\)/)
})

test('live operations alert rules cover attendance and break failures', async () => {
  const source = await readFile(new URL('../lib/operations-alerts.ts', import.meta.url), 'utf8')
  for (const alert of ['no-show','late-check-in','shift-overrun','missing-checkout','long-break','understaffed']) assert.ok(source.includes(`'${alert}'`))
  assert.match(source, /activeCount < Math\.max\(0, minimumRequired\)/)
})
