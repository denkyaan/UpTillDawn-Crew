import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('payment recording rejects overpayments and invalid dates',()=>{
 const action=page.slice(page.indexOf('async function recordFinancialPayment('),page.indexOf('async function updateFinancialStatus('))
 assert.match(action,/new Date\(paidOn\)\.toISOString\(\)\.slice\(0,10\)===paidOn/)
 assert.match(action,/Math\.abs\(amount\*100-Math\.round\(amount\*100\)\)/)
 assert.match(action,/\.select\('status,gross_amount'\)/)
 assert.match(action,/\.from\('admin_financial_payments'\)\.select\('amount'\)/)
 assert.match(action,/Math\.round\(amount\*100\)>remainingCents/)
 assert.match(action,/remainingCents<=0/)
})
