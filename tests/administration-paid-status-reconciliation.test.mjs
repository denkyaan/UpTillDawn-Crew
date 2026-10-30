import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('paid transition shares the complete credit-adjusted ledger reader',()=>{
 const action=page.slice(page.indexOf('async function updateFinancialStatus('),page.indexOf('async function uploadFinancialAttachment('))
 assert.match(action,/if\(status==='paid'\)/)
 assert.match(action,/loadFinancialSettlement\(supabase as unknown as SupabaseClient,id\)/)
 assert.match(action,/settlement\.outstandingCents!==0\|\|settlement\.overpaymentCents!==0/)
 assert.match(action,/\.eq\('status',existing\.status\)\.select\('id'\)/)
 assert.match(action,/updated\?\.length!==1/)
})
test('payment action validates full credit-adjusted balance and detects truncated data',()=>{
 const action=page.slice(page.indexOf('async function loadFinancialSettlement('),page.indexOf('async function updateFinancialStatus('))
 assert.match(action,/\.in\('status',\['approved','issued','paid'\]\)/)
 assert.match(action,/paymentCount>1000\|\|creditCount>1000/)
 assert.match(action,/payments\?\.length!==paymentCount\|\|credits\?\.length!==creditCount/)
 assert.match(action,/amountCents>settlement\.outstandingCents/)
 assert.match(action,/reconcileFinanceInvoice\(grossCents,paidCents,creditedCents,document\.status\)/)
})
test('database guard uses payments plus credits and prevents voiding linked credits',()=>{
 const sql=readFileSync('supabase/migrations/20261030140000_administration_settlement_guard_alignment.sql','utf8')
 assert.match(sql,/create or replace function public\.upt_admin_guard_financial_settlement/)
 assert.match(sql,/paid_total\+credited_total<>new\.gross_amount/)
 assert.match(sql,/paid_total>0 or credited_total>0/)
 assert.match(sql,/drop trigger if exists upt_admin_paid_invoice_settlement_guard/)
 assert.match(sql,/revoke execute on function public\.upt_admin_guard_financial_settlement/)
})
