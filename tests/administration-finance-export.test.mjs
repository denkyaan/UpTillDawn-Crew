import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const report=readFileSync('lib/administration/finance-report.ts','utf8')
const api=readFileSync('app/api/administration/finance/export/route.ts','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('CSV export escapes spreadsheet formulas and quotes',()=>{
 assert.match(report,/\[=\+@-\]/)
 assert.match(report,/replaceAll\('"','""'\)/)
 assert.match(report,/\\uFEFF/)
})
test('financial export requires authenticated portal access and paginates',()=>{
 assert.match(api,/getCurrentUser\(\)/)
 assert.match(api,/canOpenPortal\('administration'/)
 assert.match(api,/\.range\(offset,offset\+499\)/)
 assert.match(api,/Cache-Control':'private, no-store'/)
})
test('dashboard shows overdue buckets and export link',()=>{
 assert.match(page,/agingCounts/)
 assert.match(page,/upt_administration_finance_summary/)
 assert.match(page,/\/api\/administration\/finance\/export/)
})

test('export reconciles approved credit notes and payments without treating draft credits as settled',()=>{
 assert.match(api,/creditsByInvoice=new Map/)
 assert.match(api,/\['approved','issued','paid'\]\.includes\(doc\.status\)/)
 assert.match(api,/doc\.original_invoice_id/)
 assert.match(api,/reconciliation\.outstandingCents/)
 assert.match(api,/reconciliation\.overpaymentCents/)
 assert.match(api,/Outstanding after credits/)
 assert.match(api,/Overpayment after credits/)
})
test('export has deterministic payment pagination and rejects blocked accounts and invalid amounts',()=>{
 assert.match(api,/\.order\('document_id'\)\.order\('id'\)/)
 assert.match(api,/current\.account_blocked===true/)
 assert.match(api,/Number\.isFinite\(gross\)/)
 assert.match(api,/Europe\/Brussels/)
})

test('credit notes are not counted as open invoices in finance CSV',()=>{
 assert.match(api,/doc\.kind==='sales_invoice'\|\|doc\.kind==='purchase_invoice'/)
 assert.match(api,/'not_applicable'/)
 assert.match(api,/creditsByInvoice\.get\(doc\.id\)/)
})
test('payment ledger rejects invalid values and sums in integer cents',()=>{
 assert.match(api,/payment\.amount===null/)
 assert.match(api,/Number\.isFinite\(Number\(payment\.amount\)\)/)
 assert.match(api,/Math\.round\(Number\(payment\.amount\)\*100\)/)
})

test('finance export rejects incomplete paginated snapshots and distinguishes exact limit',()=>{
 assert.match(api,/documentTotal=count/)
 assert.match(api,/paymentTotal=count/)
 assert.match(api,/documents\.length!==documentTotal/)
 assert.match(api,/payments\.length!==paymentTotal/)
 assert.match(api,/documentTotal>10000/)
 assert.match(api,/paymentTotal>50000/)
 assert.match(api,/count:'exact'/)
})

test('finance export detects changing counts and unstable pagination',()=>{
 assert.match(api,/documentTotal!==null&&documentTotal!==count/)
 assert.match(api,/paymentTotal!==null&&paymentTotal!==count/)
 assert.match(api,/seenDocumentIds\.has\(doc\.id\)/)
 assert.match(api,/seenPaymentIds\.has\(payment\.id\)/)
 assert.match(api,/doc\.id<=previousDocumentId/)
 assert.match(api,/key<=previousPaymentId/)
 assert.match(api,/Document pagination changed during export/)
 assert.match(api,/Payment pagination changed during export/)
})

test('export exposes financial reconciliation exceptions',()=>{
 assert.match(api,/reconcileFinanceInvoice/)
 assert.match(api,/Reconciliation issues/)
 assert.match(api,/reconciliation\?\.issues\.join/)
})

test('finance export rejects orphan ledger entries and unsafe aggregate totals',()=>{
 assert.match(api,/Payment references a missing document/)
 assert.match(api,/Credit note references a missing invoice/)
 assert.match(api,/Credit note has an invalid original invoice/)
 assert.match(api,/Payment total overflow/)
 assert.match(api,/Credit note total overflow/)
 assert.match(api,/Number\.isSafeInteger\(nextPaid\)/)
 assert.match(api,/Number\.isSafeInteger\(nextCredit\)/)
 assert.match(api,/documentById\.get\(doc\.original_invoice_id\)/)
})
