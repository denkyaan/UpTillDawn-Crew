import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const source=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
const start=source.indexOf('async function createDraft(')
const action=source.slice(start,source.indexOf('\nasync function ',start+1))

test('draft creation validates amounts server-side before numeric conversion',()=>{
 assert.ok(action.includes("String(formData.get('net_amount')??'').trim()"))
 assert.ok(action.includes("String(formData.get('tax_amount')??'').trim()"))
 assert.ok(action.includes('if(!validAmount(netRaw)||!validAmount(taxRaw))redirect('))
 assert.ok(action.indexOf('if(!validAmount(netRaw)')<action.indexOf('const net=Number(netRaw)'))
})

test('financial draft amount format rejects empty, negative and over-precise values',()=>{
 const validAmount=value=>/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)
 for(const value of ['0','0.00','12','12.5','12.50','999999999.99'])assert.equal(validAmount(value),true,value)
 for(const value of ['',' ','-1','1.234','1e3','Infinity','NaN','01','1000000000','1,50'])assert.equal(validAmount(value),false,value)
})
