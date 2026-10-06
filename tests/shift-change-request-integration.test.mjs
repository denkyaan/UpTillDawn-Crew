import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  shiftChangeIsActionable,
  shiftChangeIsReadyForApproval,
  shiftChangeNeedsReplacement,
} from '../lib/shift-change-requests.ts'

test('shift change foundation keeps pending and replacement approval rules explicit', () => {
  const base={
    id:'r1',
    type:'replacement',
    shiftId:'s1',
    requesterId:'u1',
    replacementUserId:'u2',
    status:'pending',
    createdAt:0,
  }
  assert.equal(shiftChangeIsActionable(base),true)
  assert.equal(shiftChangeNeedsReplacement(base),true)
  assert.equal(shiftChangeIsReadyForApproval(base),true)
  assert.equal(shiftChangeIsReadyForApproval({...base,replacementUserId:null}),false)
  assert.equal(shiftChangeNeedsReplacement({...base,type:'claim-open-shift'}),false)
})

test('shift change storage is private and all mutation RPCs revoke anonymous execute', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102235_shift_change_request_workflow.sql',import.meta.url),'utf8')
  assert.match(source,/upt_private\.shift_change_requests/)
  assert.match(source,/shift_change_requests_no_direct_access/)
  assert.match(source,/as restrictive/)
  for(const fn of [
    'upt_request_shift_change',
    'upt_respond_shift_change',
    'upt_cancel_shift_change',
    'upt_decide_shift_change',
    'upt_shift_change_requests',
  ])assert.match(source,new RegExp('revoke all on function public\\.'+fn))
})

test('replacement swap and open-shift claim all revalidate planning constraints', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102235_shift_change_request_workflow.sql',import.meta.url),'utf8')
  for(const kind of ['swap','replacement','claim-open-shift'])assert.ok(source.includes("'"+kind+"'"),kind)
  assert.match(source,/user_available_for_shift/)
  assert.match(source,/user_has_shift_overlap/)
  assert.match(source,/shift_capacity_would_exceed/)
  assert.match(source,/for update/)
  assert.match(source,/scheduled_start>now\(\)/)
  assert.match(source,/response_status='declined'/)
})

test('requests are revision aware and stale planning is detected before approval', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102235_shift_change_request_workflow.sql',import.meta.url),'utf8')
  assert.match(source,/source_revision_at/)
  assert.match(source,/target_revision_at/)
  assert.match(source,/v_source\.updated_at>v_request\.source_revision_at/)
  assert.match(source,/v_target\.updated_at>v_request\.target_revision_at/)
  assert.match(source,/is_stale boolean/)
})

test('swap approval atomically exchanges both assignees and forces fresh confirmation', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102235_shift_change_request_workflow.sql',import.meta.url),'utf8')
  assert.match(source,/v_old_source_user:=v_source\.user_id/)
  assert.match(source,/v_old_target_user:=v_target\.user_id/)
  assert.match(source,/set user_id=v_old_target_user/)
  assert.match(source,/set user_id=v_old_source_user/)
  assert.match(source,/response_status='pending'/)
  assert.match(source,/confirmation_revision=now\(\)/)
})

test('nominee consent and admin approval are separate audited stages', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102235_shift_change_request_workflow.sql',import.meta.url),'utf8')
  assert.match(source,/replacement_response='accepted'/)
  assert.match(source,/De andere medewerker heeft nog niet ingestemd/)
  for(const action of [
    'shift.change.requested',
    'shift.change.replacement.accepted',
    'shift.change.replacement.declined',
    'shift.change.cancelled',
    'shift.change.rejected',
    'shift.change.approved',
  ])assert.ok(source.includes(action),action)
  assert.match(source,/insert into public\.crew_notifications/)
})

test('shift change UI exposes replacement swap claim nominee response and admin decision', async () => {
  const page=await readFile(new URL('../app/(app)/workplaces/page.tsx',import.meta.url),'utf8')
  const controls=await readFile(new URL('../components/crew/shift-change-controls.tsx',import.meta.url),'utf8')
  const actions=await readFile(new URL('../lib/actions/uptilldawn.ts',import.meta.url),'utf8')

  for(const rpc of ['upt_shift_change_requests','upt_claimable_shifts','upt_shift_change_candidates','upt_swap_candidates'])assert.ok(page.includes(rpc),rpc)
  for(const label of ['VERVANGING AANVRAGEN','DEZE RUIL AANVRAGEN','DIENST CLAIMEN','ACCEPTEREN','WEIGEREN','GOEDKEUREN','AFWIJZEN'])assert.ok(controls.includes(label),label)
  for(const action of ['requestShiftReplacement','requestShiftSwap','claimOpenShift','respondShiftChange','cancelShiftChange','decideShiftChange'])assert.ok(actions.includes('function '+action),action)
})

test('shift change foreign keys have dedicated covering indexes', async () => {
  const source=await readFile(new URL('../supabase/migrations/20260927102924_shift_change_request_fk_indexes.sql',import.meta.url),'utf8')
  assert.match(source,/shift_change_requests_workplace_fk_idx/)
  assert.match(source,/shift_change_requests_requester_fk_idx/)
  assert.match(source,/shift_change_requests_decided_by_fk_idx/)
})
