import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateFinanceSummary} from '../lib/administration/finance-summary.ts'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('accepts only safe nonnegative invoice reconciliation counts',()=>{
 assert.equal(validateFinanceSummary({unpaid:'0',partial:'1',settled:'42',overpaid:'0'}),true)
 for(const value of [null,[],{}, {unpaid:'-1',partial:'0',settled:'0',overpaid:'0'},{unpaid:'0',partial:'1.5',settled:'0',overpaid:'0'},{unpaid:'0',partial:'0',settled:'9007199254740992',overpaid:'0'}])assert.equal(validateFinanceSummary(value),false)
})
test('finance summary export is authorized, read-only and private',()=>{
 const route=read('../app/api/administration/finance/summary/export/route.ts')
 for(const required of ['administrationAccess()','upt_administration_finance_summary','validateFinanceSummary(data)','financeCsv(','private, no-store','nosniff'])assert.ok(route.includes(required))
 assert.ok(!route.includes('.insert(')&&!route.includes('.update(')&&!route.includes('.delete('))
})
test('finance summary offers localized export only for valid data',()=>{
 const ui=read('../components/administration/finance-reconciliation-summary.tsx')
 assert.ok(ui.includes('!error&&valid&&<Link'))
 assert.ok(ui.includes('/api/administration/finance/summary/export'))
 for(const label of ['CSV downloaden','Télécharger CSV','Download CSV','CSV herunterladen'])assert.ok(ui.includes(label))
})
