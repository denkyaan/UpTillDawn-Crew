import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { handoverCanBeAccepted, handoverHasOpenWork } from '../lib/shift-handover.ts'

test('handover foundation only accepts ready handovers with an incoming responsible', () => {
  const base = {
    id: 'h1',
    eventId: 'e1',
    workplaceId: 'w1',
    outgoingResponsibleId: 'r1',
    status: 'ready',
    openTaskIds: ['t1'],
    openIncidentIds: [],
    createdAt: 0,
  }
  assert.equal(handoverCanBeAccepted({ ...base, incomingResponsibleId: 'r2' }), true)
  assert.equal(handoverCanBeAccepted({ ...base, incomingResponsibleId: null }), false)
  assert.equal(handoverCanBeAccepted({ ...base, incomingResponsibleId: 'r2', status: 'draft' }), false)
  assert.equal(handoverHasOpenWork({ ...base, incomingResponsibleId: 'r2' }), true)
})

test('handover storage is private and workflow RPCs are explicitly scoped', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927092938_shift_handover_workflow.sql', import.meta.url), 'utf8')
  assert.match(source, /upt_private\.shift_handovers/)
  assert.match(source, /status in \('draft','ready','accepted'\)/)
  assert.match(source, /shift_handovers_no_direct_access/)
  assert.match(source, /as restrictive/)
  assert.match(source, /create or replace function public\.upt_handover_candidates/)
  assert.match(source, /create or replace function public\.upt_save_shift_handover/)
  assert.match(source, /create or replace function public\.upt_accept_shift_handover/)
  assert.match(source, /create or replace function public\.upt_shift_handovers/)
  assert.match(source, /revoke all on function public\.upt_save_shift_handover/)
  assert.match(source, /revoke all on function public\.upt_accept_shift_handover/)
})

test('ready handover snapshots real open assignment work and unresolved incidents', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927093543_shift_handover_open_work_snapshot_fix.sql', import.meta.url), 'utf8')
  assert.match(source, /public\.task_assignments/)
  assert.match(source, /ta\.status<>'COMPLETED'/)
  assert.doesNotMatch(source, /lower\(coalesce\(t\.status/)
  assert.match(source, /i\.resolved_at is null/)
  assert.match(source, /for update of w/)
})

test('handover save state does not depend on PostgreSQL FOUND after snapshot queries', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927093408_shift_handover_found_state_fix.sql', import.meta.url), 'utf8')
  assert.match(source, /v_existing boolean:=false/)
  assert.match(source, /v_existing:=found/)
  assert.match(source, /if not v_existing then/)
})

test('handover workflow is audited and uses existing notification delivery', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927092938_shift_handover_workflow.sql', import.meta.url), 'utf8')
  for (const action of ['SHIFT_HANDOVER_DRAFT_SAVED','SHIFT_HANDOVER_READY','SHIFT_HANDOVER_ACCEPTED']) {
    assert.ok(source.includes(action), action)
  }
  assert.match(source, /insert into public\.crew_notifications/)
  assert.match(source, /shift_handover/)
  assert.match(source, /open_task_count/)
  assert.match(source, /open_incident_count/)
})

test('responsible operations integrates handover candidates, history and actions', async () => {
  const page = await readFile(new URL('../app/(app)/operations/page.tsx', import.meta.url), 'utf8')
  const actions = await readFile(new URL('../lib/actions/uptilldawn.ts', import.meta.url), 'utf8')
  const panel = await readFile(new URL('../components/responsible/shift-handover-panel.tsx', import.meta.url), 'utf8')

  assert.match(page, /upt_shift_handovers/)
  assert.match(page, /upt_handover_candidates/)
  assert.match(page, /ShiftHandoverPanel/)
  assert.match(actions, /export async function saveShiftHandover/)
  assert.match(actions, /export async function acceptShiftHandover/)
  assert.match(actions, /upt_save_shift_handover/)
  assert.match(actions, /upt_accept_shift_handover/)
  assert.match(panel, /handoverCanBeAccepted/)
  assert.match(panel, /CONCEPT OPSLAAN/)
  assert.match(panel, /KLAAR VOOR OVERDRACHT/)
  assert.match(panel, /OVERDRACHT ACCEPTEREN/)
  assert.match(panel, /OPEN TAKEN BEKIJKEN/)
  assert.match(panel, /OPEN INCIDENTEN BEKIJKEN/)
})

test('handover foreign keys have dedicated covering indexes', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927093636_shift_handover_fk_indexes.sql', import.meta.url), 'utf8')
  assert.match(source, /shift_handovers_workplace_fk_idx/)
  assert.match(source, /shift_handovers_outgoing_fk_idx/)
})
