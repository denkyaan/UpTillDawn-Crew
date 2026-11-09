import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('administration acceptance has one Head Admin, two deputies and Head self-approval',()=>{
 const sql=read('tests/sql/administration-workflow-isolated-e2e.sql')
 for(const phrase of ['qa_accept_users','upt_leadership_assign','head_self_approval','right_hand_approval_denied','delegation_change_denied','staff_denied','office_case_approval_denied','repeat_run_deliveries']) assert.ok(sql.includes(phrase),phrase)
 assert.match(sql,/begin;/i)
 assert.match(sql,/rollback;/i)
 assert.doesNotMatch(sql,/TEST_(?:ADMIN|OFFICE|STAFF)_ID/)
})
test('Finance role acceptance cannot use a real identity or retain a synthetic account',()=>{
 const sql=read('tests/sql/administration-finance-isolated-rls.sql')
 assert.match(sql,/BEGIN;/)
 assert.match(sql,/ROLLBACK;/)
 assert.match(sql,/INSERT INTO auth\.users/i)
 assert.match(sql,/Non-admin was allowed to create a financial document/)
 assert.match(sql,/Non-admin was allowed to create a financial counterparty/)
 assert.doesNotMatch(sql,/TEST_NON_ADMIN_ID/)
})

test('Head-only approval and 3 leadership slots are enforced in database and UI',()=>{
 const migration=read('supabase/migrations/20261109112256_single_head_and_two_deputies.sql')
 const guard=read('tests/sql/administration_operational_approval_queue.sql')
 const page=read('components/administration/operational-work-queue.tsx')
 const manager=read('app/(app)/admin/management/leadership/page.tsx')
 for(const token of ["'head'","'left_hand'","'right_hand'","guard_single_head_profile","Only Head Admin may manage","upt_leadership_assign","upt_admin_set_portal_role","role='staff'"]){
  assert.ok(migration.includes(token),'Missing governance feature: '+token)
 }
 assert.ok(guard.includes('Head must be able to approve own submitted case'))
 assert.doesNotMatch(page,/row\.created_by!==access\.user\.id/)
 assert.doesNotMatch(migration,/The submitter cannot review their own dossier/)
 const editor=read('components/admin/personnel-two-role-editor.tsx')
 assert.match(manager,/redirect\('\/personnel'\)/)
 assert.match(editor,/form action=\{savePersonnelRoleSlot\}/)
 assert.match(editor,/name="confirm_head"/)
 assert.match(editor,/name="role_one"/)
 assert.match(editor,/name="role_two"/)
})
