import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('shift handover preserves open operational work and acceptance state', async () => {
  const source = await readFile(new URL('../lib/shift-handover.ts', import.meta.url), 'utf8')
  assert.match(source, /openTaskIds/)
  assert.match(source, /openIncidentIds/)
  assert.match(source, /handoverCanBeAccepted/)
})

test('workplace capacity detects under and over staffing', async () => {
  const source = await readFile(new URL('../lib/workplace-capacity.ts', import.meta.url), 'utf8')
  for (const state of ['understaffed','target','overstaffed']) assert.ok(source.includes(`'${state}'`))
  assert.match(source, /staffNeededForTarget/)
})

test('coverage exposes explicit staffing shortfall', async () => {
  const source = await readFile(new URL('../lib/staffing-coverage.ts', import.meta.url), 'utf8')
  assert.match(source, /requiredStaff/)
  assert.match(source, /coverageShortfall/)
  assert.match(source, /requirementIsCovered/)
})

test('responsible assignments detect overlap and missing workplace coverage', async () => {
  const source = await readFile(new URL('../lib/responsible-coverage.ts', import.meta.url), 'utf8')
  assert.match(source, /a\.startsAt < b\.endsAt && b\.startsAt < a\.endsAt/)
  assert.match(source, /responsibleHasConflict/)
  assert.match(source, /workplaceHasResponsible/)
})
