import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027223000_administration_invoice_due_dates.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('approved invoices require ordered issue and due dates',()=>{
 assert.match(sql,/due_date>=issue_date/)
 assert.match(sql,/new\.issue_date is null or new\.due_date is null/)
 assert.match(sql,/approved','issued','paid/)
})
test('finance forms support dates and draft-only updates',()=>{
 assert.match(page,/async function updateInvoiceDates/)
 assert.match(page,/action=\{updateInvoiceDates\}/)
 assert.match(page,/name="issue_date"/)
 assert.match(page,/name="due_date"/)
 assert.match(page,/\.eq\('status','draft'\)/)
})
