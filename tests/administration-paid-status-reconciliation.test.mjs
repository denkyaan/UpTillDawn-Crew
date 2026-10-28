import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('paid transition requires complete recorded payment',()=>{
 const action=page.slice(page.indexOf('async function updateFinancialStatus('),page.indexOf('async function uploadFinancialAttachment('))
 assert.match(action,/if\(status==='paid'\)/)
 assert.match(action,/\.select\('gross_amount'\)/)
 assert.match(action,/\.from\('admin_financial_payments'\)\.select\('amount'\)/)
 assert.match(action,/paidCents!==invoiceCents/)
 assert.match(action,/Number\.isSafeInteger\(paidCents\)/)
})
