import test from 'node:test'
import assert from 'node:assert/strict'
import {invoiceStatuses,invoiceStatusLabels,isClosedInvoice,isOverdueInvoice} from '../lib/administration/invoice-status.ts'

test('void invoices are closed and cannot be reported as overdue',()=>{
 for(const status of ['paid','void']){
  assert.equal(isClosedInvoice(status),true)
  assert.equal(isOverdueInvoice(status,'2026-10-01','2026-11-07'),false)
 }
 for(const status of ['draft','review'])assert.equal(isOverdueInvoice(status,'2026-10-01','2026-11-07'),false)
 for(const status of ['approved','issued']){
  assert.equal(isOverdueInvoice(status,'2026-10-01','2026-11-07'),true)
  assert.equal(isOverdueInvoice(status,null,'2026-11-07'),false)
  assert.equal(isOverdueInvoice(status,'2026-11-07','2026-11-07'),false)
 }
})

test('all persisted invoice statuses have labels in every supported language',()=>{
 assert.ok(invoiceStatuses.includes('void'))
 assert.ok(!invoiceStatuses.includes('cancelled'))
 for(const labels of Object.values(invoiceStatusLabels))for(const status of invoiceStatuses)assert.ok(labels[status]?.length)
})
