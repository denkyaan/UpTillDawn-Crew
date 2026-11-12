import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {checkProductionSchema} from '../scripts/production-schema-contract.mjs'

const expectedTables=[
 'tasks','portal_role_assignments','admin_counterparties','admin_financial_documents',
 'admin_financial_lines','admin_payment_reminders','admin_financial_payments',
 'admin_operational_obligations','admin_inventory_receipts','admin_ticket_sales',
 'admin_provider_event_mappings','admin_provider_transactions','admin_bank_statement_transactions',
 'admin_financial_line_imports','admin_provider_bank_settlements',
 'admin_provider_bank_settlement_items','upt_organization_leadership','upt_personnel_role_slots',
]
const origin='https://eakoavcieossazqzplke.supabase.co'
const key='nonsecret-test-key'

test('Deploy production and Maker readiness cover exactly the same 18 required relations',async()=>{
 const probed=[]
 const response=await checkProductionSchema({url:origin,key,fetcher:async u=>{
  probed.push(u.pathname.split('/').at(-1))
  return {status:200,json:async()=>[]}
 }})
 assert.equal(response.length,18)
 assert.deepEqual(probed.sort(),[...expectedTables].sort())
 const overview=readFileSync('app/api/god/overview/route.ts','utf8')
 const source=overview.split('const expected=[')[1]?.split('] as const')[0]
 assert.ok(source,'God Mode must retain a production readiness inventory')
 const actual=[...source.matchAll(/'([a-z0-9_]+):([a-z0-9_]+)'/g)].map(x=>x[1])
 assert.deepEqual(actual.sort(),[...expectedTables].sort(),
  'Maker God Mode readiness should never contradict the production release preflight')
})

test('A missing November finance or dual-role contract cannot pass a production release',async()=>{
 const relations=[
  'admin_provider_transactions','admin_bank_statement_transactions','admin_financial_line_imports',
  'admin_provider_bank_settlements','admin_provider_bank_settlement_items',
  'upt_organization_leadership','upt_personnel_role_slots',
 ]
 for(const relation of relations){
  const fetcher=async url=>url.pathname.endsWith('/'+relation)
   ?{status:404,json:async()=>({code:'PGRST205'})}
   :{status:200,json:async()=>[]}
  await assert.rejects(checkProductionSchema({url:origin,key,fetcher}),error=>
   error.message.includes(relation+': HTTP 404'))
 }
})
