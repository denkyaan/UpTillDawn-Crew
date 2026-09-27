import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { escalationDelayMs, escalationIsDue, escalationTarget } from '../lib/escalation-policy.ts'

test('unresolved help escalation policy remains five minutes and admin-fallback aware', () => {
  assert.equal(escalationDelayMs('unresolved-help'), 5 * 60_000)
  assert.equal(escalationIsDue({
    type: 'unresolved-help',
    createdAt: 1_000,
    responsibleAvailable: true,
  }, 1_000 + 5 * 60_000), true)
  assert.equal(escalationTarget({
    type: 'unresolved-help',
    createdAt: 0,
    responsibleAvailable: false,
  }), 'admin')
})

test('incident escalation migration persists escalation state and extends the existing runtime cron', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927094235_incident_runtime_escalation.sql', import.meta.url), 'utf8')

  assert.match(source, /add column if not exists escalated_at timestamptz/)
  assert.match(source, /add column if not exists escalation_reason text/)
  assert.match(source, /created_at<=now\(\)-interval '5 minutes'/)
  assert.match(source, /acknowledged_at is null/)
  assert.match(source, /resolved_at is null/)
  assert.match(source, /escalated_at is null/)
  assert.match(source, /INCIDENT_ESCALATED/)
  assert.match(source, /HELP ESCALATIE/)
  assert.match(source, /refresh_operational_alerts\(\), upt_private\.refresh_incident_escalations\(\)/)
  assert.match(source, /revoke all on function upt_private\.refresh_incident_escalations/)
})

test('current work context follows the canonical post-transition workplace', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927094235_incident_runtime_escalation.sql', import.meta.url), 'utf8')

  assert.match(source, /create or replace function public\.upt_current_work_context/)
  assert.match(source, /upt_private\.current_session_workplace\(ws\.id\)/)
  assert.match(source, /ws\.user_id=auth\.uid\(\)/)
  assert.match(source, /revoke all on function public\.upt_current_work_context\(\) from public,anon/)
})

test('incident creation enforces current workplace after a live transition', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927094235_incident_runtime_escalation.sql', import.meta.url), 'utf8')

  assert.match(source, /Melding moet aan je huidige werkplek gekoppeld worden/)
  assert.match(source, /coalesce\(p_workplace,v_current_workplace\)/)
  assert.match(source, /response_status<>'declined'/)
  assert.match(source, /\/incidents\?id=/)
})

test('help UI uses current work context and surfaces escalation state', async () => {
  const source = await readFile(new URL('../app/(app)/incidents/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /upt_current_work_context/)
  assert.match(source, /escalated_at,escalation_reason/)
  assert.match(source, /GEËSCALEERD/)
  assert.match(source, /Na 5 minuten zonder erkenning geëscaleerd naar admin/)
  assert.match(source, /responsiblePairs/)
  assert.match(source, /currentContext\.workplace_id/)
})
