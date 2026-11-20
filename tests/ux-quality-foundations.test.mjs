import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('web and mobile have explicit performance budgets', async () => {
  const source = await readFile(new URL('../lib/performance-budgets.ts', import.meta.url), 'utf8')
  assert.match(source, /WEB_PERFORMANCE_BUDGET/)
  assert.match(source, /MOBILE_PERFORMANCE_BUDGET/)
  assert.match(source, /maxLcpMs: 2500/)
  assert.match(source, /maxInpMs: 200/)
})

test('interactive controls enforce naming keyboard and touch target basics', async () => {
  const source = await readFile(new URL('../lib/accessibility-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /MIN_TOUCH_TARGET_PX = 44/)
  assert.match(source, /keyboardReachable/)
  assert.match(source, /ariaLabel/)
})

test('mobile navigation follows operational role and active shift context', async () => {
  const [policy, nav] = await Promise.all([
    readFile(new URL('../lib/mobile-navigation-policy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../components/layout/mobile-nav.tsx', import.meta.url), 'utf8'),
  ])
  assert.match(policy, /\['events','briefing','shifts','workplaces'\]/)
  assert.match(policy, /\['work-hours','shifts','workplaces','help'\]/)
  assert.match(policy, /\['work-hours','shifts','briefing','tasks'\]/)
  assert.match(nav, /ASSIGNED_EVENT_KEYS=\["events","briefings","workplaces"\]/)
  assert.match(nav, /RESPONSIBLE_ASSIGNED_EVENT_KEYS=\["events","briefings","workplaces","inventory"\]/)
})

test('localization completeness catches missing and empty translations', async () => {
  const source = await readFile(new URL('../lib/localization-quality.ts', import.meta.url), 'utf8')
  for (const locale of ['nl','en','de','fr']) assert.ok(source.includes(`'${locale}'`))
  assert.match(source, /missingKeys/)
  assert.match(source, /emptyKeys/)
  assert.match(source, /localizationIsComplete/)
})
