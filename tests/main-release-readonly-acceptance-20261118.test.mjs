import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read=p=>readFileSync(p,'utf8')
const preflight=read('scripts/production-preflight-readonly.sql')
const roleMatrix=read('tests/sql/main-seven-role-permission-matrix.sql')
const headWorkflow=read('tests/sql/administration-workflow-isolated-e2e.sql')
const finance=read('tests/sql/main-administration-finance-head-acceptance.sql')
const docs=read('docs/MAIN_RELEASE_READINESS_20261118.md')

test('Production release preflight checks recent Main session-bound and finance privacy guarantees',()=>{
 const required=[
  'verified_self_scoped_session_context',
  'chat_read_hotpaths_are_non_mutating',
  'approved_gate_rejects_blocked_accounts',
  'task_read_and_manage_bind_actor_to_session',
  'driver_supervisor_binds_actor_to_session',
  'responsible_binds_actor_to_session',
  'successful_admin_login_audit_is_own_account_only',
  'event_command_revenue_is_admin_only',
  'retired_pre_qr_attendance_closed_and_qr_flow_enabled',
 ]
 for(const name of required){
  assert.ok(preflight.includes("SELECT '"+name+"', true"),'Missing required production gate: '+name)
 }
 assert.match(preflight,/main_tip_migration_in_history', false/)
 assert.match(preflight,/WHERE version='20261118121657'/)
 assert.match(preflight,/BLOCK RELEASE/)
 assert.doesNotMatch(preflight,/\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(?:TABLE|FUNCTION|ON|INTO|public\.|auth\.)/i,
  'Preflight may only inspect metadata, never modify production')
})

test('Main Head and deputies acceptance uses one existing Head and a full database rollback',()=>{
 assert.match(headWorkflow,/join public\.profiles p on p\.id=l\.user_id/)
 assert.match(headWorkflow,/l\.slot='head'/)
 assert.match(headWorkflow,/from qa_accept_users where name<>'admin'/)
 assert.match(headWorkflow,/q\.name<>'admin'/)
 assert.doesNotMatch(headWorkflow,/upt_leadership_assign\('head'/)
 for(const token of ["upt_leadership_assign('left_hand'","upt_leadership_assign('right_hand'","upt_administration_payroll_rows","run_deadline_notifications","rollback;"]){
  assert.ok(headWorkflow.includes(token),'Missing workflow regression: '+token)
 }
})

test('Finance lifecycle checks complete invoice approval, credit, settlement, overpayment and void guards without persistent writes',()=>{
 assert.match(finance,/^BEGIN;/m)
 assert.match(finance,/SET LOCAL ROLE authenticated/)
 assert.match(finance,/upt_organization_leadership l/)
 assert.match(finance,/INSERT INTO public\.admin_financial_documents/)
 assert.match(finance,/INSERT INTO public\.admin_financial_payments/)
 assert.match(finance,/Overpayment accepted/)
 assert.match(finance,/Credit-adjusted invoice did not settle/)
 assert.match(finance,/Documents with payments or approved credit notes cannot be voided/)
 assert.match(finance,/^ROLLBACK;/m)
 assert.doesNotMatch(finance,/\\set|:'TEST_ADMIN_ID'|https?:\/\/|auth\.admin\.createUser/)
})

test('Seven-role Main SQL acceptance includes live JWT-scoped positive and negative permission checks',()=>{
 for(const role of ['head_admin','left_hand','right_hand','administration','promotion','responsible','staff']){
  assert.match(roleMatrix,new RegExp("'"+role+"','e2e-"))
 }
 assert.match(roleMatrix,/SET LOCAL ROLE authenticated/)
 assert.match(roleMatrix,/public\.upt_is_approved\(\)/)
 assert.match(roleMatrix,/public\.upt_can_manage_administration\(\)/)
 assert.match(roleMatrix,/v_can_manage IS DISTINCT FROM v_row\.expected_admin/)
 assert.match(roleMatrix,/^ROLLBACK;/m)
})

test('Release document clearly separates verified Main tests, blocked production alignment and external vendor proof',()=>{
 assert.match(docs,/8 required checks/)
 assert.match(docs,/upt_current_session_context/)
 assert.match(docs,/EventPay/)
 assert.match(docs,/Documenso/)
 assert.match(docs,/Peppol/)
 assert.match(docs,/Weeztix/)
 assert.match(docs,/SumUp/)
 assert.match(docs,/Production must remain unchanged/)
})
