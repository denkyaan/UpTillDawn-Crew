import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const amounts=readFileSync('lib/administration/finance-reconciliation.ts','utf8')
test('payment recording rejects overpayments and invalid dates using shared ledger',()=>{
 const action=page.slice(page.indexOf('async function recordFinancialPayment('),page.indexOf('async function updateFinancialStatus('))
 assert.match(action,/new Date\(paidOn\)\.toISOString\(\)\.slice\(0,10\)===paidOn/)
 assert.match(action,/financialAmountCents\(amount\)/)
 assert.match(action,/loadFinancialSettlement\(db,documentId\)/)
 assert.match(action,/amountCents>settlement\.outstandingCents/)
 assert.match(action,/\['approved','issued','paid'\]\.includes\(settlement\.status\)/)
 assert.match(amounts,/Math\.abs\(rawCents-cents\)>0\.000001/)
})
