import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027200000_administration_payment_ledger.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('payment ledger is append-only and rejects overpayments',()=>{
 assert.match(sql,/create table if not exists public\.admin_financial_payments/)
 assert.match(sql,/paid_total\+new\.amount>doc\.gross_amount/)
 assert.match(sql,/where id=new\.document_id for update/)
 assert.match(sql,/create unique index if not exists admin_financial_payments_reference_unique/)
 assert.match(sql,/grant select,insert on public\.admin_financial_payments to authenticated/)
 assert.doesNotMatch(sql,/grant select,insert,update/)
})
test('finance UI records partial payments and shows outstanding balances',()=>{
 assert.match(page,/async function recordFinancialPayment/)
 assert.match(page,/action=\{recordFinancialPayment\}/)
 assert.match(page,/name="bank_reference"/)
 assert.match(page,/name="paid_on"/)
 assert.match(page,/Outstanding balance/)
})
