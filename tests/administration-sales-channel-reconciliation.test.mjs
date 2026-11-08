import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileExternalSales} from '../lib/administration/sales-channel-reconciliation.ts'
const payment=(overrides={})=>({provider:'sumup',transactionId:'tx1',eventId:'event1',category:'tickets',amountCents:2500,currency:'EUR',status:'paid',saleReference:'order1',...overrides})
test('groups tickets, merch and tokens without double counting matching cross-provider sales',()=>{
 const result=reconcileExternalSales([payment(),payment({provider:'eventix',transactionId:'ticket1'}),payment({transactionId:'tx2',category:'merch',saleReference:'shirt1',amountCents:1500}),payment({transactionId:'tx3',category:'tokens',saleReference:'tokens1',amountCents:1000})])
 assert.deepEqual(result.totals,{tickets:2500,merch:1500,tokens:1000})
 assert.equal(result.duplicates.length,1)
})
test('does not merge sales based on matching amount alone',()=>{
 const result=reconcileExternalSales([payment(),payment({transactionId:'tx2',saleReference:'order2'})])
 assert.equal(result.totals.tickets,5000)
})
test('unmatched and pending payments cannot enter booked revenue',()=>{
 const result=reconcileExternalSales([payment({saleReference:null}),payment({transactionId:'tx2',status:'pending'})])
 assert.equal(result.totals.tickets,0);assert.equal(result.unmatched.length,1);assert.equal(result.pending.length,1)
})
test('conflicting duplicate transaction and inconsistent cross-provider sale are flagged',()=>{
 const result=reconcileExternalSales([payment(),payment({amountCents:100}),payment({provider:'eventix',transactionId:'ticket1',amountCents:100})])
 assert.equal(result.conflicts.length,2);assert.equal(result.totals.tickets,2500)
})
test('refunds reduce revenue and invalid amounts are rejected',()=>{
 const result=reconcileExternalSales([payment(),payment({transactionId:'refund1',status:'refunded',amountCents:500}),payment({transactionId:'bad',amountCents:NaN})])
 assert.equal(result.totals.tickets,2000);assert.equal(result.conflicts.length,1)
})

test('refunds without a linked sale or larger than original are held for review',()=>{
 const r=reconcileExternalSales([payment({transactionId:'orphan',status:'refunded',saleReference:'unknown',amountCents:100}),payment(),payment({transactionId:'large',status:'refunded',amountCents:2600})])
 assert.equal(r.totals.tickets,2500);assert.equal(r.conflicts.length,2)
})
test('multiple distinct partial refunds can be applied up to the original sale amount',()=>{
 const r=reconcileExternalSales([payment(),payment({transactionId:'refund1',status:'refunded',amountCents:500}),payment({transactionId:'refund2',status:'refunded',amountCents:500})])
 assert.equal(r.totals.tickets,1500);assert.equal(r.conflicts.length,0)
})

test('rejects blank external transaction and event identities',()=>{
 const r=reconcileExternalSales([payment({transactionId:' '}),payment({transactionId:'tx2',eventId:' '})])
 assert.equal(r.accepted.length,0);assert.equal(r.conflicts.length,2)
})
test('blank sale references remain unmatched rather than booked',()=>{
 const r=reconcileExternalSales([payment({saleReference:' '})])
 assert.equal(r.totals.tickets,0);assert.equal(r.unmatched.length,1)
})
test('structured sale keys prevent colon-delimiter collisions across event and sale identifiers',()=>{
 const r=reconcileExternalSales([
  payment({eventId:'event:1',saleReference:'order'}),
  payment({transactionId:'tx2',eventId:'event',saleReference:'1:order'})
 ])
 assert.equal(r.totals.tickets,5000);assert.equal(r.duplicates.length,0)
})

test('refund arriving before original sale is reconciled once paid record is verified',()=>{
 const r=reconcileExternalSales([payment({transactionId:'refund1',status:'refunded',amountCents:500}),payment()])
 assert.equal(r.totals.tickets,2000);assert.equal(r.conflicts.length,0)
})
test('cumulative partial refunds cannot exceed the original paid amount',()=>{
 const r=reconcileExternalSales([payment(),payment({transactionId:'refund1',status:'refunded',amountCents:2000}),payment({transactionId:'refund2',status:'refunded',amountCents:600})])
 assert.equal(r.totals.tickets,500);assert.equal(r.conflicts.length,1)
})
test('duplicate refund transactions are idempotent and zero refunds are rejected',()=>{
 const refund=payment({transactionId:'refund1',status:'refunded',amountCents:500})
 const r=reconcileExternalSales([payment(),refund,refund,payment({transactionId:'zero',status:'refunded',amountCents:0})])
 assert.equal(r.totals.tickets,2000);assert.equal(r.duplicates.length,1);assert.equal(r.conflicts.length,1)
})

test('paid transaction wins over an earlier pending webhook for the same provider ID',()=>{
 const pending=payment({status:'pending',amountCents:2500})
 const paid=payment()
 const r=reconcileExternalSales([pending,paid])
 assert.equal(r.totals.tickets,2500)
 assert.equal(r.accepted.length,1)
 assert.equal(r.pending.length,0)
 assert.equal(r.duplicates.length,1)
 assert.equal(r.conflicts.length,0)
})
test('paid transaction wins regardless of input order and supports subsequent refunds',()=>{
 const pending=payment({status:'pending'})
 const paid=payment()
 const refund=payment({transactionId:'refund',status:'refunded',amountCents:500})
 for(const records of [[pending,refund,paid],[refund,paid,pending],[paid,pending,refund]]){
  const r=reconcileExternalSales(records)
  assert.equal(r.totals.tickets,2000)
  assert.equal(r.conflicts.length,0)
  assert.equal(r.duplicates.length,1)
 }
})
test('pending callback with conflicting identity remains flagged even after settlement',()=>{
 const r=reconcileExternalSales([payment({status:'pending',saleReference:'different'}),payment()])
 assert.equal(r.totals.tickets,2500)
 assert.equal(r.conflicts.length,1)
})

test('stale pending with mismatched settled amount is a conflict, not a duplicate',()=>{
 const r=reconcileExternalSales([payment({status:'pending',amountCents:1500}),payment()])
 assert.equal(r.totals.tickets,2500)
 assert.equal(r.conflicts.length,1)
 assert.equal(r.duplicates.length,0)
})
test('pending snapshots matching settled amount are idempotent',()=>{
 const r=reconcileExternalSales([payment({status:'pending'}),payment(),payment({status:'pending'})])
 assert.equal(r.totals.tickets,2500)
 assert.equal(r.duplicates.length,2)
 assert.equal(r.conflicts.length,0)
})
