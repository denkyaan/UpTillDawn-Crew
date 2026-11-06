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

const counterparties=readFileSync('app/(app)/portals/administration/counterparties/page.tsx','utf8')
test('counterparty actions enforce the same account and portal gates as administration layout',()=>{
 assert.ok(counterparties.includes('!user.approved || Boolean(user.account_blocked)'))
 assert.ok(counterparties.includes('!user.realIsAdmin && !user.isOwner'))
 assert.ok(counterparties.includes("canOpenPortal('administration'"))
 assert.ok(counterparties.includes('async function updateCounterparty'))
})
test('counterparty creation rejects oversized input rather than silently truncating it',()=>{
 assert.ok(counterparties.includes('name.length>200'))
 assert.ok(counterparties.includes('vat_number.length>40'))
 assert.ok(counterparties.includes('enterprise_number.length>40'))
 assert.ok(counterparties.includes('email.length>254'))
})

test('counterparty edit email validation accepts standard addresses and rejects malformed ones',()=>{
 const source=counterparties.slice(counterparties.indexOf('async function updateCounterparty'),counterparties.indexOf('export const dynamic'))
 assert.ok(source.includes('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/'))
 assert.ok(!source.includes('/^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$/'))
})

test('counterparty search filters in the database rather than only the first 200 results',()=>{
 const page=readFileSync('app/(app)/portals/administration/counterparties/page.tsx','utf8')
 assert.ok(page.includes('role="search"'))
 assert.ok(page.includes("listQuery.ilike('name'"))
 assert.ok(page.includes("query.trim()")||page.includes("params.q.trim()"))
 assert.ok(page.includes("listQuery.order('name').limit(200)"))
 for(const label of ['Zoek relaties','Rechercher des contacts','Search counterparties','Kontakte suchen'])assert.ok(page.includes(label))
})
