import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027233000_administration_invoice_review_readiness.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('invoice review requires counterparty, dates, number and positive amount',()=>{
 assert.match(sql,/new\.counterparty_id is null/)
 assert.match(sql,/new\.document_number is null/)
 assert.match(sql,/new\.issue_date is null or new\.due_date is null/)
 assert.match(sql,/new\.gross_amount<=0/)
 assert.match(sql,/new\.status='review'/)
})
test('finance page exposes missing review fields and guards review button',()=>{
 assert.match(page,/Missing before review/)
 assert.match(page,/Ready for review/)
 assert.match(page,/next!=='review'/)
 assert.match(page,/d\.counterparty_id&&d\.document_number/)
})
