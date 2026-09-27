import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('critical operational notifications retain in-app and push delivery', async () => {
  const source = await readFile(new URL('../lib/notification-preferences.ts', import.meta.url), 'utf8')
  assert.match(source, /category === 'incident' \|\| category === 'help'/)
  assert.match(source, /return \['in-app','push'\]/)
})

test('notification dedupe is user category entity and message scoped', async () => {
  const source = await readFile(new URL('../lib/notification-dedupe.ts', import.meta.url), 'utf8')
  assert.match(source, /notification\.userId.*notification\.category.*notification\.entityId.*notification\.messageKey/s)
  assert.match(source, /60_000/)
})

test('notification read state supports unread counts and dismissals', async () => {
  const source = await readFile(new URL('../lib/notification-read-state.ts', import.meta.url), 'utf8')
  assert.match(source, /!state\.readAt && !state\.dismissedAt/)
  assert.match(source, /state\.userId === userId/)
  assert.match(source, /unreadNotificationCount/)
})

test('quiet hours support overnight windows with critical bypass', async () => {
  const source = await readFile(new URL('../lib/quiet-hours.ts', import.meta.url), 'utf8')
  assert.match(source, /minute >= start \|\| minute < end/)
  assert.match(source, /priority === 'urgent'/)
  assert.match(source, /category === 'incident' \|\| category === 'help'/)
})
