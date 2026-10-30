import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('paid transition requires complete credit-adjusted settlement',()=>{
 const action=page.slice(page.indexOf('async function updateFinancialStatus('),page.indexOf('async function uploadFinancialAttachment('))
 assert.match(action,/if\(status==='paid'\)/)
 assert.match(action,/\.from\('admin_financial_payments'\)\.select\('amount',\{count:'exact'\}\)/)
 assert.match(action,/\.eq\('original_invoice_id',id\)/)
 assert.match(action,/\['approved','issued','paid'\]\.includes\(credit\.status\)/)
 assert.match(action,/paidCents\+creditCents!==grossCents/)
 assert.match(action,/Number\.isSafeInteger\(paidCents\)/)
 assert.match(action,/paymentCount>1000\|\|creditCount>1000/)
})

test('database blocks paid invoice status without full credit-adjusted settlement',()=>{
 const sql=readFileSync('supabase/migrations/20261030133000_administration_paid_invoice_settlement_guard.sql','utf8')
 assert.match(sql,/new\.status='paid' and old\.status is distinct from new\.status/)
 assert.match(sql,/new\.kind in \('sales_invoice','purchase_invoice'\)/)
 assert.match(sql,/from public\.admin_financial_payments where document_id=new\.id/)
 assert.match(sql,/original_invoice_id=new\.id and kind='credit_note'/)
 assert.match(sql,/paid_total\+credited_total<>new\.gross_amount/)
 assert.match(sql,/before update on public\.admin_financial_documents/)
})
