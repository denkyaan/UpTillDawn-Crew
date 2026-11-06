import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
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
