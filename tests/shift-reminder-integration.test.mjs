import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { shiftReminderAt, shiftReminderShouldSend } from '../lib/shift-reminders.ts'

test('shift reminder foundation keeps day-before, two-hour and start-soon timings', () => {
  const start=10_000_000
  const context={shiftStartsAt:start,checkedInAt:null}
  assert.equal(shiftReminderAt('day-before',context),start-24*60*60_000)
  assert.equal(shiftReminderAt('hours-before',context),start-2*60*60_000)
  assert.equal(shiftReminderAt('start-soon',context),start-15*60_000)
  assert.equal(shiftReminderShouldSend('start-soon',context,start-15*60_000),true)
})

test('shift reminder delivery is revision-aware and private', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927100105_shift_reminder_delivery.sql',import.meta.url),'utf8')
  assert.match(source,/upt_private\.shift_reminder_receipts/)
  assert.match(source,/primary key \(shift_id,kind,revision_at\)/)
  assert.match(source,/as restrictive/)
  assert.match(source,/response_status='accepted'/)
  assert.match(source,/confirmed_at>=coalesce\(s\.confirmation_revision,s\.created_at\)/)
  assert.match(source,/coalesce\(s\.confirmation_revision,s\.created_at\) as revision_at/)
  assert.match(source,/on conflict do nothing/)
  assert.match(source,/revoke all on function upt_private\.send_shift_reminders/)
})

test('only the most relevant reminder window is selected on each cron pass', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927100105_shift_reminder_delivery.sql',import.meta.url),'utf8')
  assert.match(source,/scheduled_start<=now\(\)\+interval '15 minutes' then 'start-soon'/)
  assert.match(source,/scheduled_start<=now\(\)\+interval '2 hours' then 'hours-before'/)
  assert.match(source,/else 'day-before'/)
  for(const title of ['Shift binnen 24 uur','Shift binnen 2 uur','Shift start binnenkort'])assert.ok(source.includes(title))
  assert.match(source,/'shift_reminder'/)
  assert.match(source,/'\/shifts'/)
})

test('reminder delivery is suppressed after arrival or a pending start request', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927100228_shift_reminder_checkin_suppression.sql',import.meta.url),'utf8')
  assert.match(source,/public\.work_sessions/)
  assert.match(source,/ws\.shift_id=s\.id/)
  assert.match(source,/public\.check_ins/)
  assert.match(source,/ci\.shift_id=s\.id/)
  assert.match(source,/ci\.status in \('pending','approved'\)/)
})

test('shift reminders are consolidated into the existing operational minute cron', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927100105_shift_reminder_delivery.sql',import.meta.url),'utf8')
  assert.match(source,/uptilldawn-operational-alerts/)
  assert.match(source,/'\* \* \* \* \*'/)
  assert.match(source,/send_shift_reminders\(\), upt_private\.notify_break_allowance\(\), upt_private\.refresh_operational_alerts\(\), upt_private\.refresh_incident_escalations\(\)/)
})
