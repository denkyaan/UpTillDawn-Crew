import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('draft counterparty can be updated only for drafts and valid UUIDs',()=>{
 assert.match(page,/async function updateDraftCounterparty/)
 assert.match(page,/document\.status!=='draft'/)
 assert.match(page,/\.eq\('status','draft'\)\.select\('id'\)/)
 assert.match(page,/counterpartyId&&!uuid\.test\(counterpartyId\)/)
})
test('invoice direction is validated before counterparty assignment',()=>{
 assert.match(page,/document\.kind==='sales_invoice'/)
 assert.match(page,/document\.kind==='purchase_invoice'/)
 assert.match(page,/action=\{updateDraftCounterparty\}/)
 assert.match(page,/d\.kind==='sales_invoice'\?/)
 assert.match(page,/d\.kind==='purchase_invoice'\?/)
})
