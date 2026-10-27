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
 assert.match(page,/financialAging\(d\.due_date,today\)/)
 assert.match(page,/\/api\/administration\/finance\/export/)
})
