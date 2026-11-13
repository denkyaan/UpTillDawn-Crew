import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {MAX_REVENUE_TRANSACTIONS,revenueCoverageComplete,summarizeSalesRevenue} from '../lib/sales/revenue-summary.ts'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('registered sales are calculated over the entire selected scope, with refunds deducted exactly once',()=>{
  const rows=[
    {transaction_type:'sale',total_cents:1200,payment_method:'card',sale_category:'merch'},
    {transaction_type:'sale',total_cents:700,payment_method:'cash',sale_category:'token'},
    {transaction_type:'refund',total_cents:200,payment_method:'card',sale_category:'merch'},
  ]
  assert.deepEqual(summarizeSalesRevenue(rows),{event:1700,merch:1000,token:700,cash:700,card:1000})
  assert.equal(revenueCoverageComplete(rows.length,rows.length),true)
})

test('unknown counts, missing pages and oversized scopes are not presented as complete revenue',()=>{
  assert.equal(revenueCoverageComplete(null,1000),false)
  assert.equal(revenueCoverageComplete(1001,1000),false)
  assert.equal(revenueCoverageComplete(1001,1001),true)
  assert.equal(revenueCoverageComplete(MAX_REVENUE_TRANSACTIONS,MAX_REVENUE_TRANSACTIONS),true)
  assert.equal(revenueCoverageComplete(MAX_REVENUE_TRANSACTIONS+1,MAX_REVENUE_TRANSACTIONS+1),false)
  assert.equal(revenueCoverageComplete(-1,0),false)
  assert.throws(()=>summarizeSalesRevenue([{transaction_type:'sale',total_cents:1.5,payment_method:'cash',sale_category:'token'}]))
})

test('sales page scopes database reads before pagination and never displays incomplete totals',()=>{
  const page=read('app/(app)/sales/page.tsx')
  assert.match(page,/\\.eq\\('event_id',selected\\.id\\)/)
  assert.match(page,/firstQuery\\.eq\\('workplace_id',selectedWorkplaceId\\)/)
  assert.match(page,/pageQuery\\.eq\\('workplace_id',selectedWorkplaceId\\)/)
  assert.match(page,/selectedWorkplaceId=workplaces\\.find\\(row=>row\\.id===params\\.workplace\\)/)
  assert.match(page, /count:'exact'/)
  assert.match(page,/revenueCoverageComplete\\(transactionCount,revenueRows\\.length\\)/)
  assert.match(page,/revenueTotals\\?money\\(revenueTotals\\.event\\):'—'/)
  assert.doesNotMatch(page,/transactions=transactions\\.filter\\(transaction=>transaction\\.workplace_id===params\\.workplace\\)/)
  assert.doesNotMatch(page,/money\\(eventRevenue\\)/)
})
