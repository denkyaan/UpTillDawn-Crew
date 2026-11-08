import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSalesReconciliationReport,salesReconciliationCsv,salesReconciliationExceptionsCsv} from '../lib/administration/sales-reconciliation-report.ts'
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

test('report includes multiple partial refunds even when delivered before the sale',()=>{
 const r=buildSalesReconciliationReport([
  payment({transactionId:'r1',status:'refunded',amountCents:300}),
  payment({transactionId:'r2',status:'refunded',amountCents:400}),
  payment()
 ])
 assert.equal(r.totals.tickets,1300)
 assert.equal(r.events[0].refundedCents.tickets,700)
 assert.equal(r.exceptions.conflicts.length,0)
})

test('CSV exports separate booked revenue from review exceptions',()=>{
 const report=buildSalesReconciliationReport([
  payment(),
  payment({transactionId:'bad',amountCents:-1}),
  payment({transactionId:'pending',status:'pending'}),
  payment({transactionId:'unmatched',saleReference:null})
 ])
 const csv=salesReconciliationCsv(report)
 const exceptions=salesReconciliationExceptionsCsv(report)
 assert.match(csv,/"event_id";"category";"paid_cents";"refunded_cents";"net_cents";"accepted_transactions"/)
 assert.match(csv,/event1/)
 assert.doesNotMatch(csv,/unmatched/)
 assert.match(exceptions,/conflicts/)
 assert.match(exceptions,/pending/)
 assert.match(exceptions,/unmatched/)
})
test('CSV export escapes formula-like event identifiers',()=>{
 const report=buildSalesReconciliationReport([payment({eventId:'=HYPERLINK(1)'})])
 const csv=salesReconciliationCsv(report)
 assert.match(csv,/"'=HYPERLINK\(1\)"/)
})

test('consolidated event net balances match paid minus refunds across categories',()=>{
 const report=buildSalesReconciliationReport([
  payment(),
  payment({transactionId:'r1',status:'refunded',amountCents:400}),
  payment({transactionId:'m1',eventId:'event2',category:'merch',saleReference:'shirt',amountCents:1500}),
  payment({transactionId:'m2',eventId:'event2',category:'merch',saleReference:'shirt',status:'refunded',amountCents:200}),
  payment({transactionId:'k1',eventId:'event3',category:'tokens',saleReference:'tokens',amountCents:800})
 ])
 assert.deepEqual(report.totals,{tickets:1600,merch:1300,tokens:800})
 for(const category of ['tickets','merch','tokens']){
  assert.equal(report.events.reduce((sum,event)=>sum+event.netCents[category],0),report.totals[category])
  for(const event of report.events)assert.equal(event.paidCents[category]-event.refundedCents[category],event.netCents[category])
 }
})
