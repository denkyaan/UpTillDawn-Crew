import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {reconcileFinanceInvoice,financialAmountCents,totalFinancialCents} from '../lib/administration/finance-reconciliation.ts'
test('partial payments and credits reconcile in integer cents',()=>{
 assert.deepEqual(reconcileFinanceInvoice(10001,4000,3001,'issued'),{outstandingCents:3000,overpaymentCents:0,issues:[]})
})
test('fully settled invoice with wrong status is flagged',()=>{
 assert.deepEqual(reconcileFinanceInvoice(10000,6000,4000,'issued').issues,['settled_but_not_marked_paid'])
})
test('paid invoice with balance and overpayment are flagged',()=>{
 assert.deepEqual(reconcileFinanceInvoice(10000,9000,0,'paid').issues,['marked_paid_with_balance'])
 assert.deepEqual(reconcileFinanceInvoice(10000,10001,0,'paid').issues,['overpayment'])
})
test('draft with recorded payment is flagged',()=>{
 assert.deepEqual(reconcileFinanceInvoice(10000,100,0,'draft').issues,['unapproved_document_has_settlement'])
})
test('invalid cents and overflow fail closed',()=>{
 for(const amount of [-1,0.1,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>reconcileFinanceInvoice(amount,0,0,'issued'))
 assert.throws(()=>reconcileFinanceInvoice(100,Number.MAX_SAFE_INTEGER,1,'issued'))
})

test('invoice details and finance CSV both use shared reconciliation',()=>{
 const detail=readFileSync('app/(app)/portals/administration/modules/invoices/[id]/page.tsx','utf8')
 const csv=readFileSync('app/api/administration/finance/export/route.ts','utf8')
 assert.match(detail,/reconcileFinanceInvoice\(Math\.round\(invoiceAmount\*100\)/)
 assert.match(detail,/reconciliation\.outstandingCents\/100/)
 assert.match(detail,/reconciliation\.overpaymentCents\/100/)
 assert.match(csv,/reconcileFinanceInvoice\(/)
})

test('monetary parsing accepts exact cents and rejects malformed precision',()=>{
 assert.equal(financialAmountCents('12.34'),1234)
 assert.equal(financialAmountCents(0),0)
 assert.equal(totalFinancialCents(['0.10','0.20','99.70']),10000)
 for(const invalid of [null,undefined,'',false,'NaN',-0.01,0.001,Infinity,Number.MAX_SAFE_INTEGER])
  assert.throws(()=>financialAmountCents(invalid))
 assert.throws(()=>totalFinancialCents([Number.MAX_SAFE_INTEGER/100,1]))
})
