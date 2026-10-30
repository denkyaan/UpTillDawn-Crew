import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileFinanceInvoice} from '../lib/administration/finance-reconciliation.ts'
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
