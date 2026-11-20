import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('invoice line editing is restricted to drafts and validates all amounts',()=>{
 const action=page.slice(page.indexOf('async function updateInvoiceLine('),page.indexOf('async function removeInvoiceLine('))
 assert.match(action,/document\?\.status!=='draft'/)
 assert.match(action,/Number\.isFinite/)
 assert.match(action,/description\.length>500/)
 assert.match(action,/\.eq\('id',lineId\)\.eq\('document_id',documentId\)/)
 assert.match(action,/\.update\(\{description,quantity,unit_price:unitPrice,vat_rate:vatRate\}\)/)
})
test('invoice line editing is available with four-language UI',()=>{
 assert.match(page,/action=\{updateInvoiceLine\}/)
 assert.match(page,/nl:'Regel aanpassen',fr:'Modifier la ligne',en:'Edit line',de:'Position bearbeiten'/)
})
