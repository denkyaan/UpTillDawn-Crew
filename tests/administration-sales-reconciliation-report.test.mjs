import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSalesReconciliationReport} from '../lib/administration/sales-reconciliation-report.ts'
const payment=(overrides={})=>({provider:'sumup',transactionId:'t1',eventId:'event1',category:'tickets',amountCents:2000,currency:'EUR',status:'paid',saleReference:'sale1',...overrides})
test('reports net sales per event and category with explicit refunds',()=>{
 const r=buildSalesReconciliationReport([
  payment(),
  payment({provider:'eventix',transactionId:'e1'}),
  payment({transactionId:'r1',status:'refunded',amountCents:300}),
  payment({transactionId:'m1',eventId:'event2',category:'merch',saleReference:'shirt',amountCents:1500}),
  payment({transactionId:'k1',eventId:'event2',category:'tokens',saleReference:'tokens',amountCents:500})
 ])
 assert.deepEqual(r.totals,{tickets:1700,merch:1500,tokens:500})
 assert.equal(r.events.length,2)
 assert.deepEqual(r.events[0].netCents,{tickets:1700,merch:0,tokens:0})
 assert.equal(r.events[0].refundedCents.tickets,300)
 assert.equal(r.events[1].paidCents.merch,1500)
 assert.equal(r.exceptions.duplicates.length,1)
 assert.equal(r.acceptedCount,4)
})
test('unmatched, pending and conflicting records never inflate event totals',()=>{
 const r=buildSalesReconciliationReport([
  payment({saleReference:null}),
  payment({transactionId:'pending',status:'pending'}),
  payment({transactionId:'bad',amountCents:-5})
 ])
 assert.equal(r.events.length,0)
 assert.equal(r.exceptions.unmatched.length,1)
 assert.equal(r.exceptions.pending.length,1)
 assert.equal(r.exceptions.conflicts.length,1)
})
test('report does not mutate provider input or expose pending as accepted',()=>{
 const rows=Object.freeze([Object.freeze(payment())])
 const r=buildSalesReconciliationReport(rows)
 assert.equal(r.acceptedCount,1)
 assert.equal(rows[0].amountCents,2000)
})
