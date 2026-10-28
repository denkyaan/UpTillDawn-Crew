import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const sql=readFileSync('supabase/migrations/20261027190000_administration_financial_approval_guard.sql','utf8')
test('financial status transitions are enforced at database boundary',()=>{
 assert.match(sql,/before insert or update on public\.admin_financial_documents/)
 assert.match(sql,/old\.status='draft' and new\.status='review'/)
 assert.match(sql,/old\.status='review' and new\.status='approved'/)
 assert.match(sql,/old\.status='approved' and new\.status in \('issued','paid','void'\)/)
 assert.match(sql,/old\.status='issued' and new\.status in \('paid','void'\)/)
 assert.match(sql,/not public\.upt_is_admin\(\)/)
})
test('submitted document and approval evidence cannot be rewritten',()=>{
 assert.match(sql,/Submitted financial document content is immutable/)
 assert.match(sql,/new\.approved_by is distinct from auth\.uid\(\)/)
 assert.match(sql,/Approval evidence is immutable/)
 assert.match(sql,/revoke execute on function public\.upt_admin_guard_financial_transition\(\)/)
})
