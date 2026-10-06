import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('canonical live workplace follows the latest confirmed transition', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927091501_canonical_live_workplace_status.sql', import.meta.url), 'utf8')
  assert.match(source, /current_session_workplace/)
  assert.match(source, /workplace_transitions/)
  assert.match(source, /order by wt\.confirmed_at desc,wt\.id desc/)
  assert.match(source, /coalesce\(/)
})

test('staff live status uses current workplace and effective employee role', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927091501_canonical_live_workplace_status.sql', import.meta.url), 'utf8')
  assert.match(source, /upt_staff_workplace_live_status/)
  assert.match(source, /current_session_workplace\(ws\.id\)/)
  assert.match(source, /upt_effective_role\(auth\.uid\(\)\) in \('employee','staff'\)/)
  assert.match(source, /s\.response_status is null or s\.response_status <> 'declined'/)
})

test('manager live sessions are scoped by the current workplace', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927091501_canonical_live_workplace_status.sql', import.meta.url), 'utf8')
  assert.match(source, /upt_manager_live_sessions/)
  assert.match(source, /upt_is_admin\(auth\.uid\(\)\)/)
  assert.match(source, /upt_is_responsible\(a\.event_id,a\.workplace_id,auth\.uid\(\)\)/)
  assert.match(source, /revoke all on function public\.upt_manager_live_sessions\(\) from public,anon/)
})

test('operations and scoped root overview consume canonical manager live sessions', async () => {
  const operations = await readFile(new URL('../app/(app)/operations/page.tsx', import.meta.url), 'utf8')
  const dashboard = await readFile(new URL('../app/(app)/page.tsx', import.meta.url), 'utf8')
  const client = await readFile(new URL('../app/(app)/operations/operations-client.tsx', import.meta.url), 'utf8')

  assert.match(operations, /upt_manager_live_sessions/)
  assert.doesNotMatch(operations, /liveShifts=/)
  assert.match(dashboard, /upt_manager_live_sessions/)\n  assert.match(dashboard, /activeRows\.filter\(row=>activeResponsibleWorkplaces\.has\(row\.workplace_id\)\)/)
  assert.match(dashboard, /ResponsibleLivePersonnel/)
  assert.match(client, /ws\.workplace_name/)
  assert.match(client, /ws\.session_id/)
})

test('live understaffing uses canonical current workplace counts and deduplicated episodes', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927091757_live_understaffing_alerts.sql', import.meta.url), 'utf8')

  assert.match(source, /'understaffed'/)
  assert.match(source, /active_staff_count/)
  assert.match(source, /current_session_workplace\(ws\.id\)=p_workplace/)
  assert.match(source, /operational_alerts_open_understaffed_idx/)
  assert.match(source, /where resolved_at is null and kind='understaffed'/)
  assert.match(source, /Werkplek onderbezet/)
  assert.match(source, /active_staff/)
  assert.match(source, /minimum_staff/)
})

test('understaffing is visible through the existing scoped operational alert surface', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927091757_live_understaffing_alerts.sql', import.meta.url), 'utf8')
  const client = await readFile(new URL('../app/(app)/operations/operations-client.tsx', import.meta.url), 'utf8')

  assert.match(source, /drop function if exists public\.upt_operational_alerts/)
  assert.match(source, /upt_is_responsible\(oa\.event_id,oa\.workplace_id,auth\.uid\(\)\)/)
  assert.match(client, /ONDERBEZET/)
  assert.match(client, /alert\.active_staff/)
  assert.match(client, /alert\.minimum_staff/)
})
