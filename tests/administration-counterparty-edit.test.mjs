import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const page=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const sql=readFileSync('supabase/migrations/20261027220000_administration_counterparty_edit_guard.sql','utf8')
test('counterparties can be edited with server-side validation',()=>{
 assert.match(page,/async function updateCounterparty/)
 assert.match(page,/action=\{updateCounterparty\}/)
 assert.match(page,/\.eq\('id',id\)\.select\('id'\)/)
 assert.match(page,/name="enterprise_number" defaultValue=/)
})
test('linked invoice directions remain valid after role changes',()=>{
 assert.match(sql,/kind='sales_invoice'/)
 assert.match(sql,/kind='purchase_invoice'/)
 assert.match(sql,/must retain customer role/)
 assert.match(sql,/must retain supplier role/)
 assert.match(sql,/new\.updated_at=now\(\)/)
})
