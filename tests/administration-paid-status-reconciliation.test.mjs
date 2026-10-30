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
