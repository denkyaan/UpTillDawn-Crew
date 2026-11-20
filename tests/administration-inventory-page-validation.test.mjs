import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')
test('inventory pagination rejects noncanonical page parameters',()=>{
 assert.ok(source.includes('/^[1-9][0-9]{0,3}$/.test(requestedPage)'))
 assert.ok(source.includes('Number.isSafeInteger(parsedPage)'))
 assert.ok(source.includes('inventoryPageSize=100'))
 assert.ok(source.includes('inventoryStart=(inventoryPage-1)*inventoryPageSize'))
})

test('invoice pagination uses the same canonical bounded validation as inventory',()=>{
 assert.ok(source.includes('/^[1-9][0-9]{0,3}$/.test(invoicePage)'))
 assert.ok(source.includes('Number.isSafeInteger(invoicePageNumber)'))
 assert.ok(source.includes('invoicePageSize=50'))
 assert.ok(source.includes('invoiceOffset=(currentInvoicePage-1)*invoicePageSize'))
})
