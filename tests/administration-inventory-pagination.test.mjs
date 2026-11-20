import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('app/(app)/portals/administration/modules/[slug]/page.tsx','utf8')

test('inventory keeps selected older events accessible and labeled',()=>{
 assert.match(page,/const selectedEvent=slug==="inventory"&&typeof requestedEvent==="string"/)
 assert.match(page,/\.eq\("id",selectedEvent\)\.maybeSingle\(\)/)
 assert.match(page,/inventoryEventChoices\.map\(event=>/)
 assert.match(page,/const inventoryEventNames=new Map\(\[\.\.\.inventoryEventChoices,/)
})

test('invoice pagination has exclusive page boundaries and count-based next navigation',()=>{
 assert.match(page,/\.range\(invoiceOffset,invoiceOffset\+invoicePageSize-1\)/)
 assert.match(page,/\.select\("id,kind,status,gross_amount,due_date,document_number,currency,issue_date",\{count:"exact"\}\)/)
 assert.match(page,/\(invoiceSummaryRows\?\.count\?\?0\)>currentInvoicePage\*invoicePageSize/)
})
