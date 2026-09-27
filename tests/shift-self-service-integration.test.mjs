import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { declineRequiresReason } from '../lib/crew-self-service.ts'

test('declining an assigned shift requires an explicit reason', () => {
  assert.equal(declineRequiresReason({
    shiftId: 'shift',
    userId: 'user',
    response: 'declined',
    reason: 'Niet beschikbaar',
    updatedAt: 0,
  }), false)

  assert.equal(declineRequiresReason({
    shiftId: 'shift',
    userId: 'user',
    response: 'declined',
    reason: '   ',
    updatedAt: 0,
  }), true)
})

test('shift actions integrate accept decline and admin reassignment', async () => {
  const source = await readFile(new URL('../lib/actions/uptilldawn.ts', import.meta.url), 'utf8')
  assert.match(source, /export async function declineShift/)
  assert.match(source, /declineRequiresReason/)
  assert.match(source, /upt_respond_shift/)
  assert.match(source, /p_response:'declined'/)
  assert.match(source, /export async function reassignShift/)
  assert.match(source, /upt_reassign_shift/)
  assert.match(source, /neq\('response_status','declined'\)/)
})

test('shift UI exposes response state refusal and controlled reassignment', async () => {
  const source = await readFile(new URL('../app/(app)/shifts/page.tsx', import.meta.url), 'utf8')
  for (const label of ['WACHT OP REACTIE','SHIFT GEWEIGERD','ALSNOCH BEVESTIGEN','DIENST WEIGEREN','HERPLAN DIENST']) {
    assert.ok(source.includes(label), label)
  }
  assert.match(source, /response_reason/)
  assert.match(source, /declineShift/)
  assert.match(source, /reassignShift/)
  assert.match(source, /eventMembers/)
})

test('declined shifts are excluded from staffing coverage', async () => {
  const source = await readFile(new URL('../app/(app)/workplaces/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /neq\('response_status','declined'\)/)
})

test('database migration makes shift response and reassignment auditable and authoritative', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260927085413_shift_self_service_reassignment.sql', import.meta.url), 'utf8')
  for (const column of ['response_status','response_reason','responded_at']) assert.ok(source.includes(column))
  assert.match(source, /shifts_response_status_check/)
  assert.match(source, /shifts_response_reason_check/)
  assert.match(source, /create or replace function public\.upt_respond_shift/)
  assert.match(source, /create or replace function public\.upt_reassign_shift/)
  assert.match(source, /response_status <> 'declined'/)
  assert.match(source, /shift\.declined/)
  assert.match(source, /shift\.accepted/)
  assert.match(source, /shift\.reassigned/)
  assert.match(source, /confirmation_revision=now\(\)/)
  assert.match(source, /revoke all on function public\.upt_respond_shift/)
  assert.match(source, /revoke all on function public\.upt_reassign_shift/)
})
