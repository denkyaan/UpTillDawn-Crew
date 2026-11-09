import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('administration acceptance uses independent Admin review, denies creator self-approval and office escalation',()=>{
 const sql=read('tests/sql/administration-workflow-isolated-e2e.sql')
 for(const phrase of ['qa_accept_users','assign_approved','v_self_denied','Creator self-approval must be denied','Independent Admin review did not complete','staff_denied','office_case_approval_denied','repeat_run_deliveries']) assert.ok(sql.includes(phrase),phrase)
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
