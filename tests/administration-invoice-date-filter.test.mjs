import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validInvoiceDate,invoiceDateRange} from '../lib/administration/invoice-filter-validation.ts'
import {financialAging} from '../lib/administration/finance-report.ts'
const helper=readFileSync('lib/administration/invoice-filter-validation.ts','utf8')
const modulePage=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('invoice date filtering validates real calendar days and date ordering',()=>{
 assert.match(helper,/Date\.UTC\(year,month-1,day\)/)
 assert.match(helper,/getUTCFullYear\(\)===year/)
 assert.match(helper,/getUTCMonth\(\)===month-1/)
 assert.match(helper,/getUTCDate\(\)===day/)
 assert.match(helper,/start>end/)
 assert.match(modulePage,/invoiceDateRange\(invoiceFrom,invoiceTo\)/)
 assert.doesNotMatch(modulePage,/invoiceFromFilter=typeof invoiceFrom/)
})

test('invoice date filters reject impossible calendar days and reversed ranges',()=>{
 assert.equal(validInvoiceDate('2024-02-29'),'2024-02-29')
 for(const date of ['2025-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-01-01T00:00:00Z'])assert.equal(validInvoiceDate(date),'')
 assert.deepEqual(invoiceDateRange('2026-11-09','2026-11-08'),{from:'',to:''})
})
test('finance aging uses valid calendar dates and stable day boundaries',()=>{
 assert.equal(financialAging('2026-11-08','2026-11-08'),'not_due')
 assert.equal(financialAging('2026-11-07','2026-11-08'),'overdue_1_30')
 assert.equal(financialAging('2026-10-09','2026-11-08'),'overdue_1_30')
 assert.equal(financialAging('2026-10-08','2026-11-08'),'overdue_31_60')
 assert.equal(financialAging('2026-09-08','2026-11-08'),'overdue_61_plus')
 assert.equal(financialAging('2025-02-29','2026-11-08'),'no_due_date')
 assert.equal(financialAging('2026-11-01','not-a-date'),'no_due_date')
 assert.equal(financialAging(null,'2026-11-08'),'no_due_date')
})
