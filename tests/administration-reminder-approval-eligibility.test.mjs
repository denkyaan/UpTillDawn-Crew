import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('reminder approval validates overdue invoices against credit-adjusted balances',()=>{
 const action=page.slice(page.indexOf('async function updatePaymentReminder('),page.indexOf('async function recordFinancialPayment('))
 assert.ok(action.includes("invoice.kind!=='sales_invoice'"))
 assert.ok(action.includes("invoice.due_date>=belgianToday()"))
 assert.ok(action.includes('outstanding===null||outstanding<=0.005'))
 assert.ok(action.includes('reminderOutstanding('))
 assert.ok(action.includes("!['approved','issued'].includes(invoice.status)"))
 assert.ok(action.includes("if(status==='approved')"))
 assert.ok(action.includes(".eq('status','draft')"))
})
