import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const sql=readFileSync('supabase/migrations/20261027203000_administration_settlement_consistency.sql','utf8')
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
test('paid status requires full recorded settlement and void forbids prior payments',()=>{
 assert.match(sql,/paid_total<>new\.gross_amount/)
 assert.match(sql,/new\.status='void' and paid_total>0/)
 assert.match(sql,/exists\(select 1 from public\.admin_financial_payments where document_id=new\.id\)/)
})
test('financial overview and actions use ledger amounts',()=>{
 assert.match(page,/const paymentTotalFor=/)
 assert.match(page,/sum\+paymentTotalFor\(d\.id\)/)
 assert.match(page,/next!=='paid'/)
 assert.match(page,/next!=='void'/)
})
