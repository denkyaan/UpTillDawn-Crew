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

test('payment recording rejects fractional cents before reconciliation or database writes',()=>{
 const start=source.indexOf('async function recordFinancialPayment(')
 const end=source.indexOf('async function updateFinancialStatus(',start)
 assert.ok(start>=0&&end>start)
 const action=source.slice(start,end)
 assert.ok(action.includes("String(formData.get('amount')??'').trim()"))
 assert.ok(action.includes('if(!/^(?:0|[1-9]\\d{0,8})(?:\\.\\d{1,2})?$/.test(amountRaw))redirect('))
 assert.ok(action.indexOf('.test(amountRaw)')<action.indexOf('const amount=Number(amountRaw)'))
 assert.ok(action.includes('amountCents>settlement.outstandingCents'))
})

test('financial attachment uploads require canonical UUIDs and editable document states',()=>{
 const start=source.indexOf('async function uploadFinancialAttachment(')
 const end=source.indexOf('\nexport const dynamic',start)
 assert.ok(start>=0&&end>start)
 const action=source.slice(start,end)
 assert.ok(action.includes("if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)"))
 assert.ok(action.includes("!['draft','review'].includes(document.status)"))
 assert.ok(action.includes("validateUploadSecurity(file)"))
 assert.ok(action.includes("upsert:false"))
})

test('failed financial attachment metadata insert cleans up uploaded private storage object',()=>{
 const start=source.indexOf('async function uploadFinancialAttachment(')
 const end=source.indexOf('\nexport const dynamic',start)
 const action=source.slice(start,end)
 assert.ok(action.includes("if(linkError){"))
 assert.ok(action.includes(".from('admin-financial-attachments').remove([path])"))
 assert.ok(action.indexOf(".remove([path])")>action.indexOf("if(linkError){"))
 assert.ok(action.indexOf(".remove([path])")<action.indexOf("redirect('/portals/administration/finance?error=1')",action.indexOf("if(linkError){")))
})

test('adding invoice lines validates the complete canonical document UUID',()=>{
 const start=source.indexOf('async function addInvoiceLine(')
 const end=source.indexOf('async function updateInvoiceLine(',start)
 assert.ok(start>=0&&end>start)
 const action=source.slice(start,end)
 assert.ok(action.includes("if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)"))
 assert.ok(action.includes("document.status!=='draft'"))
})

test('invoice line create and update reject empty and over-precise numeric inputs',()=>{
 for(const [name,next] of [['addInvoiceLine','updateInvoiceLine'],['updateInvoiceLine','removeInvoiceLine']]){
  const start=source.indexOf('async function '+name+'(')
  const end=source.indexOf('async function '+next+'(',start+1)
  const action=source.slice(start,end)
  assert.ok(action.includes("const quantityRaw=String(formData.get('quantity')??'').trim()"))
  assert.ok(action.includes("const unitPriceRaw=String(formData.get('unit_price')??'').trim()"))
  assert.ok(action.includes("const vatRateRaw=String(formData.get('vat_rate')??'').trim()"))
  assert.ok(action.includes("if(!validDecimal(quantityRaw)||!validDecimal(unitPriceRaw)||!validDecimal(vatRateRaw))redirect("))
  assert.ok(action.indexOf('if(!validDecimal(')<action.indexOf('const quantity=Number(quantityRaw)'))
 }
})

test('counterparty payment terms validate stored issue dates before arithmetic',()=>{
 const start=source.indexOf('async function updateDraftCounterparty(')
 const end=source.indexOf('async function updateDraftNotes(',start)
 assert.ok(start>=0&&end>start)
 const action=source.slice(start,end)
 assert.ok(action.includes('Number.isNaN(Date.parse(issueDate))'))
 assert.ok(action.includes('new Date(issueDate).toISOString().slice(0,10)!==issueDate'))
 assert.ok(action.indexOf('new Date(issueDate).toISOString().slice(0,10)!==issueDate')<action.indexOf('due.setUTCDate('))
})
