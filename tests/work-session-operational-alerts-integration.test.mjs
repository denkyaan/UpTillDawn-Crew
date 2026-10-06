import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { detectShiftAlerts } from '../lib/operations-alerts.ts'

test('operations alert foundation detects overrun missing checkout and long break thresholds', () => {
  const start = 1_000_000
  const end = start + 60 * 60_000

  assert.deepEqual(
    detectShiftAlerts({
      now: end + 11 * 60_000,
      plannedStart: start,
      plannedEnd: end,
      checkedInAt: start,
      checkedOutAt: null,
    }),
    ['shift-overrun'],
  )

  assert.deepEqual(
    detectShiftAlerts({
      now: end + 21 * 60_000,
      plannedStart: start,
      plannedEnd: end,
      checkedInAt: start,
      checkedOutAt: null,
    }),
    ['shift-overrun','missing-checkout'],
  )

  assert.ok(detectShiftAlerts({
    now: start + 90 * 60_000,
    plannedStart: start,
    plannedEnd: end + 120 * 60_000,
    checkedInAt: start,
    activeBreakStartedAt: start + 50 * 60_000,
    maxBreakMinutes: 30,
  }).includes('long-break'))
})

test('runtime migration adds all work-session operational alert kinds', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  for (const kind of ['shift-overrun','missing-checkout','long-break']) {
    assert.ok(source.includes(`'${kind}'`), kind)
  }
  assert.match(source, /scheduled_end\+interval '10 minutes'/)
  assert.match(source, /scheduled_end\+interval '20 minutes'/)
  assert.match(source, />=4200/)
})

test('checkout alerts follow current workplace and suppress while stop approval is pending', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /upt_private\.current_session_workplace\(ws\.id\)/)
  assert.match(source, /co\.status='pending'/)
  assert.match(source, /co\.work_session_id=ws\.id/)
  assert.match(source, /not v_runtime\.pending_checkout/)
  assert.match(source, /kind='shift-overrun'/)
  assert.match(source, /kind='missing-checkout'/)
})

test('runtime alerts resolve and can reopen after the operational problem returns', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /oa\.kind in \('shift-overrun','missing-checkout','long-break'\)/)
  assert.match(source, /v_existing_resolved is not null/)
  assert.match(source, /resolved_at=null/)
  assert.match(source, /detected_at=now\(\)/)
})

test('break cron is consolidated without losing the 55-minute staff warning', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /seconds>=3300/)
  assert.match(source, /staff_55/)
  assert.match(source, /uptilldawn-break-allowance/)
  assert.match(source, /cron\.unschedule/)
  assert.match(source, /notify_break_allowance\(\), upt_private\.refresh_operational_alerts\(\), upt_private\.refresh_incident_escalations\(\)/)
})

test('manager notifications reuse existing push-backed notification delivery', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /Shift loopt door/)
  assert.match(source, /Stopuren ontbreken/)
  assert.match(source, /Pauze langer dan 70 minuten/)
  assert.match(source, /insert into public\.crew_notifications/)
})

test('operational alert RPC exposes observed and threshold minutes', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927095201_work_session_operational_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /observed_minutes integer/)
  assert.match(source, /threshold_minutes integer/)
  assert.match(source, /public\.upt_is_responsible\(oa\.event_id,oa\.workplace_id,auth\.uid\(\)\)/)
  assert.match(source, /revoke all on function public\.upt_operational_alerts\(\) from public,anon/)
})

test('operations UI renders overrun checkout and break alerts', async () => {
  const source = await readFile(new URL('../app/(app)/operations/operations-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /UITLOOP/)
  assert.match(source, /STOPUREN ONTBREKEN/)
  assert.match(source, /LANGE PAUZE/)
  assert.match(source, /alert\.observed_minutes/)
  assert.match(source, /alert\.threshold_minutes/)
  assert.match(source, /OperationalAlertCard/)
})
