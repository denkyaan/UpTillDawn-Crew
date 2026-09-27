import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { lateMinutes, noShowGraceMinutes, shiftIsLate, shiftIsNoShow } from '../lib/no-show-policy.ts'

test('late and no-show thresholds remain aligned with operational detection', () => {
  const shiftStartsAt = 1_000_000
  const context = { shiftStartsAt, checkedInAt: null, excused: false }

  assert.equal(shiftIsLate(context, shiftStartsAt + 10 * 60_000), false)
  assert.equal(shiftIsLate(context, shiftStartsAt + 10 * 60_000 + 1), true)
  assert.equal(noShowGraceMinutes(), 15)
  assert.equal(shiftIsNoShow(context, shiftStartsAt + 15 * 60_000), true)
  assert.equal(lateMinutes(context, shiftStartsAt + 17 * 60_000), 17)
})

test('operational alert migration schedules idempotent private detection and push-backed notifications', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927090357_operational_no_show_alerts.sql', import.meta.url), 'utf8')
  assert.match(source, /unique \(shift_id,kind\)/)
  assert.match(source, /response_status<>'declined'/)
  assert.match(source, /scheduled_start\+interval '10 minutes'/)
  assert.match(source, /scheduled_start\+interval '15 minutes'/)
  assert.match(source, /on conflict \(shift_id,kind\) do nothing/)
  assert.match(source, /insert into public\.crew_notifications/)
  assert.match(source, /uptilldawn-operational-alerts/)
  assert.match(source, /'\* \* \* \* \*'/)
  assert.match(source, /revoke all on function upt_private\.refresh_operational_alerts/)
})

test('operational alert read surface is scoped to admin or responsible', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927090357_operational_no_show_alerts.sql', import.meta.url), 'utf8')
  assert.match(source, /create or replace function public\.upt_operational_alerts/)
  assert.match(source, /public\.upt_is_admin\(auth\.uid\(\)\)/)
  assert.match(source, /public\.upt_is_responsible\(oa\.event_id,oa\.workplace_id,auth\.uid\(\)\)/)
  assert.match(source, /revoke all on function public\.upt_operational_alerts\(\) from public, anon/)
})

test('private operational alert storage has explicit deny-all direct access', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927090632_operational_alert_rls_hardening.sql', import.meta.url), 'utf8')
  assert.match(source, /as restrictive/)
  assert.match(source, /for all/)
  assert.match(source, /using \(false\)/)
  assert.match(source, /with check \(false\)/)
})

test('operations dashboard loads and renders scoped late and no-show alerts', async () => {
  const page = await readFile(new URL('../app/(app)/operations/page.tsx', import.meta.url), 'utf8')
  const client = await readFile(new URL('../app/(app)/operations/operations-client.tsx', import.meta.url), 'utf8')

  assert.match(page, /upt_operational_alerts/)
  assert.match(page, /operationalAlerts=/)
  assert.match(client, /Operationele waarschuwingen/)
  assert.match(client, /NO-SHOW/)
  assert.match(client, /TE LAAT/)
  assert.match(client, /noShowGraceMinutes/)
  assert.match(client, /lateMinutes/)
  assert.match(client, /router\.refresh\(\)/)
})


test('operational alert foreign keys are indexed for manager queries and cleanup', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927090742_operational_alert_fk_indexes.sql', import.meta.url), 'utf8')
  assert.match(source, /operational_alerts_event_idx/)
  assert.match(source, /operational_alerts_user_idx/)
})
