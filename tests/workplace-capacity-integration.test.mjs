import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { coverageWindows } from '../lib/staffing-coverage.ts'
import { workplaceCapacityIsValid } from '../lib/workplace-capacity.ts'

test('staffing coverage windows expose concurrent shortfalls across event hours', () => {
  const requirement = { workplaceId: 'w1', startsAt: 0, endsAt: 100, requiredStaff: 2 }
  const assignments = [
    { workplaceId: 'w1', startsAt: 10, endsAt: 40 },
    { workplaceId: 'w1', startsAt: 30, endsAt: 80 },
    { workplaceId: 'w2', startsAt: 0, endsAt: 100 },
  ]

  assert.deepEqual(coverageWindows(requirement, assignments), [
    { startsAt: 0, endsAt: 10, assignedStaff: 0, shortfall: 2 },
    { startsAt: 10, endsAt: 30, assignedStaff: 1, shortfall: 1 },
    { startsAt: 30, endsAt: 40, assignedStaff: 2, shortfall: 0 },
    { startsAt: 40, endsAt: 80, assignedStaff: 1, shortfall: 1 },
    { startsAt: 80, endsAt: 100, assignedStaff: 0, shortfall: 2 },
  ])
})

test('workplace capacity preserves ordered min target max invariants', () => {
  assert.equal(workplaceCapacityIsValid({ workplaceId: 'w1', minimumStaff: 2, targetStaff: 3, maximumStaff: 4 }), true)
  assert.equal(workplaceCapacityIsValid({ workplaceId: 'w1', minimumStaff: 3, targetStaff: 2, maximumStaff: 4 }), false)
  assert.equal(workplaceCapacityIsValid({ workplaceId: 'w1', minimumStaff: 2, targetStaff: 4, maximumStaff: 3 }), false)
  assert.equal(workplaceCapacityIsValid({ workplaceId: 'w1', minimumStaff: 0, targetStaff: 0, maximumStaff: null }), true)
})

test('workplace mutations persist validated capacity settings and shift actions refresh coverage', async () => {
  const source = await readFile(new URL('../lib/actions/uptilldawn.ts', import.meta.url), 'utf8')
  assert.match(source, /workplaceCapacityValues/)
  assert.match(source, /minimum_staff/)
  assert.match(source, /target_staff/)
  assert.match(source, /maximum_staff/)
  assert.match(source, /workplaceCapacityIsValid/)
  assert.match(source, /shiftMutationCheck/)
  assert.match(source, /Maximumbezetting/)
  assert.match(source, /revalidatePath\('\/workplaces'\)/)
})

test('workplace UI integrates capacity configuration and scheduled coverage state', async () => {
  const source = await readFile(new URL('../app/(app)/workplaces/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /Bezettingsregels/)
  assert.match(source, /Bezettingsplanning/)
  assert.match(source, /coverageWindows/)
  assert.match(source, /workplaceStaffingState/)
  assert.match(source, /staffNeededForTarget/)
  assert.match(source, /ONDERBEZET/)
  assert.match(source, /OVERBEZET/)
  assert.match(source, /CAPACITEIT OK/)
})

test('database migration makes maximum staffing authoritative and serialized', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927014242_workplace_capacity_planning.sql', import.meta.url), 'utf8')
  for (const column of ['minimum_staff', 'target_staff', 'maximum_staff']) assert.ok(source.includes(column))
  assert.match(source, /workplaces_staffing_capacity_check/)
  assert.match(source, /shift_capacity_would_exceed/)
  assert.match(source, /for update of w/i)
  assert.match(source, /create or replace function public\.upt_create_shift/)
  assert.match(source, /create or replace function public\.upt_update_shift/)
  assert.match(source, /revoke all on function upt_private\.shift_capacity_would_exceed/)
})
