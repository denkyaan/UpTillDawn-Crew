import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const sql=readFileSync('supabase/migrations/20261027213000_administration_counterparty_validation.sql','utf8')
test('counterparties can be created and linked to finance documents',()=>{
 assert.match(page,/async function createCounterparty/)
 assert.match(page,/action=\{createCounterparty\}/)
 assert.match(page,/name="counterparty_id"/)
 assert.match(page,/counterparty_id:counterpartyId\|\|null/)
 assert.match(page,/party\.kind/)
})
test('database checks customer and supplier directions',()=>{
 assert.match(sql,/new\.kind='sales_invoice'/)
 assert.match(sql,/new\.kind='purchase_invoice'/)
 assert.match(sql,/party_kind not in \('customer','both'\)/)
 assert.match(sql,/party_kind not in \('supplier','both'\)/)
})
