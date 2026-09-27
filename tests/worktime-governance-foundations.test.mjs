import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('break compliance uses configurable work and minimum break thresholds', async () => {
  const source = await readFile(new URL('../lib/break-compliance.ts', import.meta.url), 'utf8')
  assert.match(source, /workMinutesBeforeBreak/)
  assert.match(source, /minimumBreakMinutes/)
  assert.match(source, /breakIsDue/)
})

test('overtime remains configurable for daily weekly and break exclusion rules', async () => {
  const source = await readFile(new URL('../lib/overtime-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /dailyThresholdMinutes/)
  assert.match(source, /weeklyThresholdMinutes/)
  assert.match(source, /excludeBreaks/)
  assert.match(source, /dailyOvertimeMinutes/)
  assert.match(source, /weeklyOvertimeMinutes/)
})

test('timesheets follow submit review approve reject and lock workflow', async () => {
  const source = await readFile(new URL('../lib/timesheet-approval.ts', import.meta.url), 'utf8')
  for (const status of ['open','submitted','approved','rejected','locked']) assert.ok(source.includes(`'${status}'`))
  assert.match(source, /rejectionReason/)
})

test('time corrections retain reason explanation original and corrected values', async () => {
  const source = await readFile(new URL('../lib/time-correction-policy.ts', import.meta.url), 'utf8')
  assert.match(source, /originalMinutes/)
  assert.match(source, /correctedMinutes/)
  assert.match(source, /explanation\.trim\(\)/)
  assert.match(source, /approvedBy/)
})
