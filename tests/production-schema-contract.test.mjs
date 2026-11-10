import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {checkProductionSchema} from '../scripts/production-schema-contract.mjs'

const url='https://eakoavcieossazqzplke.supabase.co',key='test-publishable-key'
const response=(status,body)=>({status,json:async()=>body})

test('the production probe selects zero rows and accepts resolved private relations',async()=>{
 const requests=[]
 const checks=await checkProductionSchema({url,key,fetcher:async(endpoint,options)=>{
  requests.push(endpoint)
  assert.equal(options.method,'GET')
  assert.equal(options.redirect,'error')
  assert.equal(endpoint.searchParams.get('limit'),'0')
  assert.ok(endpoint.searchParams.get('select'))
  assert.deepEqual(options.headers,{apikey:key})
  const table=endpoint.pathname.split('/').at(-1)
  return table==='portal_role_assignments'?response(200,[]):response(401,{code:'42501',message:'permission denied for table '+table})
 }})
 assert.equal(checks.length,18)
 assert.equal(requests.length,checks.length)
 assert.ok(requests.some(endpoint=>endpoint.pathname.endsWith('/admin_payment_reminders')&&endpoint.searchParams.get('select').split(',').includes('revision')))
})

test('promotion task storage must be upgraded before deploying the new management flow',async()=>{
 await assert.rejects(()=>checkProductionSchema({url,key,fetcher:async endpoint=>endpoint.pathname.endsWith('/tasks')&&endpoint.searchParams.get('select').includes('promotion_only')?response(400,{code:'42703'}):response(200,[])}),/tasks: HTTP 400/)
})

test('a missing finance table blocks release even when auth RPCs would exist',async()=>{
 await assert.rejects(()=>checkProductionSchema({url,key,fetcher:async endpoint=>endpoint.pathname.endsWith('/admin_financial_lines')?response(404,{code:'PGRST205'}):response(200,[])}),/admin_financial_lines: HTTP 404/)
})

test('the reminder revision column is checked before release',async()=>{
 await assert.rejects(()=>checkProductionSchema({url,key,fetcher:async endpoint=>endpoint.pathname.endsWith('/admin_payment_reminders')&&endpoint.searchParams.get('select').includes('revision')?response(400,{code:'42703'}):response(200,[])}),/admin_payment_reminders: HTTP 400/)
})

test('invalid credentials and unrelated privilege errors cannot pass schema verification',async()=>{
 for(const body of [{message:'Invalid API key'},{code:'42501',message:'permission denied for schema public'},{code:'42501',message:'permission denied for table another_table'}]){
  await assert.rejects(()=>checkProductionSchema({url,key,fetcher:async()=>response(401,body)}),/schema is not ready/)
 }
})

test('unexpected rows, malformed responses and network failure block without logging credentials',async()=>{
 for(const fetcher of [async()=>response(200,[{id:'unexpected'}]),async()=>({status:200,json:async()=>{throw Error('invalid JSON')}}),async()=>{throw Error('Network failed: '+key)}]){
  await assert.rejects(()=>checkProductionSchema({url,key,fetcher}),error=>error.message.includes('schema is not ready')&&!error.message.includes(key))
 }
})

test('a preview database cannot be mistaken for production',async()=>{
 let called=false
 await assert.rejects(()=>checkProductionSchema({url:'https://npbjrtiolqperdgljnhi.supabase.co',key,fetcher:async()=>{called=true;return response(200,[])}}),/pinned production database/)
 assert.equal(called,false)
})

test('deployment checks the schema before changing any Worker or runtime secret',()=>{
 const workflow=readFileSync('.github/workflows/deploy-cloudflare.yml','utf8')
 const gate=workflow.indexOf('node scripts/production-schema-contract.mjs')
 assert.ok(gate>workflow.indexOf('Checkout'))
 assert.ok(gate<workflow.indexOf('Install dependencies'))
 assert.ok(gate<workflow.indexOf('wrangler secret put'))
 assert.ok(gate<workflow.indexOf('Deploy production Worker'))
})

test('post-platform finance reconciliation and role governance must be migrated before production release',async()=>{
 for(const table of ['admin_provider_transactions','admin_bank_statement_transactions','admin_financial_line_imports','admin_provider_bank_settlements','admin_provider_bank_settlement_items','upt_organization_leadership','upt_personnel_role_slots']){
  await assert.rejects(()=>checkProductionSchema({url,key,fetcher:async endpoint=>endpoint.pathname.endsWith('/'+table)?response(404,{code:'PGRST205'}):response(200,[])}),error=>error.message.includes(table+': HTTP 404'))
 }
})
