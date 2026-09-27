import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  responsibleCoverageGaps,
  responsibleCoverageIsComplete,
} from '../lib/responsible-coverage-health.ts'

test('responsible coverage reports uncovered scheduled intervals', () => {
  const shifts = [
    { userId: 'staff', workplaceId: 'w1', startsAt: 0, endsAt: 100 },
    { userId: 'lead', workplaceId: 'w1', startsAt: 20, endsAt: 80 },
  ]
  const assignments = [{ userId: 'lead', workplaceId: 'w1' }]

  assert.deepEqual(responsibleCoverageGaps('w1', shifts, assignments), [
    { startsAt: 0, endsAt: 20 },
    { startsAt: 80, endsAt: 100 },
  ])
  assert.equal(responsibleCoverageIsComplete('w1', shifts, assignments), false)
})

test('responsible coverage is complete when a responsible shift spans all scheduled work', () => {
  const shifts = [
    { userId: 'staff', workplaceId: 'w1', startsAt: 10, endsAt: 40 },
    { userId: 'lead', workplaceId: 'w1', startsAt: 0, endsAt: 50 },
  ]
  const assignments = [{ userId: 'lead', workplaceId: 'w1' }]

  assert.deepEqual(responsibleCoverageGaps('w1', shifts, assignments), [])
  assert.equal(responsibleCoverageIsComplete('w1', shifts, assignments), true)
})

test('responsible assignment mutation rejects overlapping cross-workplace responsibility before role mutation', async () => {
  const source = await readFile(new URL('../lib/actions/uptilldawn.ts', import.meta.url), 'utf8')
  const assignmentStart = source.indexOf('export async function assignResponsible')
  const assignmentEnd = source.indexOf('export async function demoteResponsibleToStaff', assignmentStart)
  const block = source.slice(assignmentStart, assignmentEnd)

  assert.match(block, /responsibleHasConflict/)
  assert.match(block, /otherResponsibleWorkplaces/)
  assert.match(block, /al verantwoordelijk op een andere werkplek/)
  assert.ok(block.indexOf('responsibleHasConflict') < block.indexOf("p_role:'responsible_lead'"))
})

test('workplace management surfaces responsible coverage health from scheduled shifts', async () => {
  const source = await readFile(new URL('../app/(app)/workplaces/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /responsibleCoverageGaps/)
  assert.match(source, /scheduled_start,scheduled_end/)
  assert.match(source, /DEKKING OK/)
  assert.match(source, /DEKKINGSGAT/)
})
