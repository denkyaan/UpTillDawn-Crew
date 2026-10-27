import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('reminder approval rechecks overdue invoice and remaining balance',()=>{
 const action=page.slice(page.indexOf('async function updatePaymentReminder('),page.indexOf('async function recordFinancialPayment('))
 assert.match(action,/if\(status==='approved'\)/)
 assert.match(action,/invoice\.kind!=='sales_invoice'/)
 assert.match(action,/invoice\.due_date>=new Date\(\)\.toISOString\(\)\.slice\(0,10\)/)
 assert.match(action,/\.from\('admin_financial_payments'\)/)
 assert.match(action,/Number\(invoice\.gross_amount\)-paid<=0\.005/)
 assert.match(action,/\.eq\('status','draft'\)/)
})
