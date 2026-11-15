import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {peppolFieldLabels,localeIndex} from '../lib/administration/peppol-copy.ts'
import {boundedQueries} from '../lib/administration/bounded-queries.ts'

const require=createRequire(import.meta.url)
const source=readFileSync('app/(app)/portals/administration/finance/page.tsx','utf8')
function financePage(db){
 const constants=source.slice(source.indexOf('const copy ='),source.indexOf('async function requireAdministration('))
 const page=source.slice(source.indexOf('export default async function FinancePage('))
 const compiled=ts.transpileModule(constants+page,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const exported={}
 const actions=Object.fromEntries([...source.matchAll(/async function (\w+)\(/g)].map(match=>[match[1],()=>null]))
 runInNewContext(compiled,{
  ...actions,exports:exported,require,boundedQueries,
  requireAdministration:async()=>({supabase:db,isAdmin:true}),requestUiLocale:async()=> 'en',
  Link:()=>null,PeppolDocumentFields:()=>null,InvoiceLineCsvImport:()=>null,CloudmersiveOcrPreview:()=>null,LocalDocumentOcrPreview:()=>null,BillingAddressFields:()=>null,peppolFieldLabels,localeIndex,
 })
 return exported.default
}
const summary={documents:'0',drafts:'0',paid_cents:'0',outstanding_cents:'0',overdue_cents:'0',overdue_1_30:'0',overdue_31_60:'0',overdue_61_plus:'0'}
function query(result,onStart){
 let builder
 builder=new Proxy({}, {get(_target,key){
  if(key==='then')return resolve=>onStart?onStart(resolve):Promise.resolve(result).then(resolve)
  return ()=>builder
 }})
 return builder
}

test('finance limits register reads to three simultaneous queries and waits for documents before requesting balances',async()=>{
 const required=new Set(['admin_financial_documents','admin_counterparties','events','admin_financial_payments','admin_payment_reminders','admin_financial_lines','admin_financial_attachments','upt_administration_finance_summary'])
 const started=new Set()
 let active=0,peak=0,documentsReturned=false,balanceRequested=false
 function load(name){
  const result={data:name==='upt_administration_finance_summary'?summary:[],error:null}
  return query(result,resolve=>{
   started.add(name)
   active++
   peak=Math.max(peak,active)
   setTimeout(()=>{
    if(name==='admin_financial_documents')documentsReturned=true
    active--
    resolve(result)
   },8)
  })
 }
 const db={from:load,rpc:(name,args)=>{
  if(name==='upt_administration_document_balances'){
   assert.equal(documentsReturned,true,'Document balances were requested before document IDs were loaded')
   assert.deepEqual(Array.from(args.p_ids),[])
   balanceRequested=true
   return Promise.resolve({data:[],error:null})
  }
  return load(name)
 }}
 const page=financePage(db)
 const result=await page({searchParams:Promise.resolve({})})
 assert.ok(result,'Finance page did not render')
 assert.deepEqual([...started].sort(),[...required].sort(),'Some financial registers were not queried')
 assert.equal(peak,3,'Finance reads must use at most three concurrent PostgREST requests')
 assert.equal(active,0,'Finance queries were still in flight after render')
 assert.equal(balanceRequested,true)
})

test('a failed document-balance lookup still prevents rendering incomplete financial totals',async()=>{
 const db={
  from:()=>query({data:[],error:null}),
  rpc:name=>Promise.resolve(name==='upt_administration_finance_summary'?{data:summary,error:null}:{data:null,error:{message:'Denied'}}),
 }
 await assert.rejects(()=>financePage(db)({searchParams:Promise.resolve({})}),/Financial ledger unavailable/)
})
