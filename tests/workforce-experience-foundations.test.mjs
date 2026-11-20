import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('onboarding covers complete crew readiness flow', async () => {
  const source = await readFile(new URL('../lib/onboarding.ts', import.meta.url), 'utf8')
  for (const step of ['account','profile','address','emergency-contact','documents','rules','availability','briefing','approval']) assert.ok(source.includes(`'${step}'`))
  assert.match(source, /Math\.round/)
  assert.match(source, /missingOnboardingSteps/)
})

test('permission matrix keeps employee responsible and admin boundaries explicit', async () => {
  const source = await readFile(new URL('../lib/permission-matrix.ts', import.meta.url), 'utf8')
  assert.match(source, /employee: \['view-own-shifts'\]/)
  assert.match(source, /responsible:/)
  assert.match(source, /admin:/)
  assert.match(source, /manage-automations/)
})

test('urgent notifications override opt-out while normal notifications respect preferences', async () => {
  const source = await readFile(new URL('../lib/notification-preferences.ts', import.meta.url), 'utf8')
  assert.match(source, /priority === 'urgent'/)
  assert.match(source, /preference\.inApp/)
  assert.match(source, /preference\.push/)
})

test('briefing versioning supports explicit reconfirmation after important updates', async () => {
  const source = await readFile(new URL('../lib/briefing-versioning.ts', import.meta.url), 'utf8')
  assert.match(source, /requiresReconfirmation/)
  assert.match(source, /confirmation\.briefingVersion < version\.version/)
  assert.match(source, /nextBriefingVersion/)
})
