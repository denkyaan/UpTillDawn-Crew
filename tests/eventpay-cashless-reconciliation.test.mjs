import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateProviderEventMappings,resolveProviderEvent} from '../lib/administration/provider-event-mapping.ts'
import {validateProviderTransactionCsv} from '../lib/administration/provider-transaction-import.ts'
import {reconcileExternalSales} from '../lib/administration/sales-channel-reconciliation.ts'
import {buildSalesReconciliationReport,salesReconciliationCsv} from '../lib/administration/sales-reconciliation-report.ts'
import {decodeProviderTransactions} from '../lib/administration/provider-transaction-report.ts'

const eventId='123e4567-e89b-42d3-a456-426614174000'
const external='evt:cashless-2026'
const header='transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at\n'
const row=(id,category,ref,amount,status='paid')=>
 `${id},${external},${category},${ref},${status},${amount},EUR,2026-11-12T09:00:00+01:00\n`
const payment=(id,category,ref,cents,status='paid')=>({
 provider:'eventpay',transactionId:id,eventId,category,amountCents:cents,currency:'EUR',status,saleReference:ref
})
const stored=(id,category,ref,cents)=>({
 id:'223e4567-e89b-42d3-a456-426614174000',event_id:eventId,
 provider:'eventpay',transaction_id:id,category,sale_reference:ref,
 status:'paid',amount_cents:String(cents),currency:'EUR',occurred_at:'2026-11-12T08:00:00.000Z'
})
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')

test('EventPay event mapping stays disabled by default and cannot silently resolve unapproved mapping',()=>{
 const mapping={provider:'eventpay',eventId,externalEventId:external,enabled:false}
 assert.deepEqual(validateProviderEventMappings([mapping]).errors,[])
 assert.equal(resolveProviderEvent('eventpay',external,[mapping]),null)
 assert.equal(resolveProviderEvent('eventpay',external,[{...mapping,enabled:true}]),eventId)
 assert.equal(resolveProviderEvent('sumup',external,[{...mapping,enabled:true}]),null)
})
test('normalized EventPay statement accepts Bar, Merch, topup and refund without assigning card balances',()=>{
 const csv=header+row('BAR-1','bar','sale-1','3.50')
   +row('MERCH-1','merch','sale-2','16.75')
   +row('RELOAD-1','topups','reload-1','20.00')
   +row('BAR-REFUND','bar','sale-1','1.50','refunded')
 const parsed=validateProviderTransactionCsv(csv,eventId,external,500,'eventpay')
 assert.deepEqual(parsed.errors,[])
 assert.equal(parsed.rows.length,4)
 assert.equal(parsed.paidCents,4025)
 assert.equal(parsed.refundedCents,150)
 assert.equal(parsed.rows.find(x=>x.category==='topups')?.amountCents,2000)
})
test('wrong-provider categories cannot be imported as a misleading cashless sale or reload',()=>{
 for(const category of ['tickets','tokens']){
  assert.ok(validateProviderTransactionCsv(header+row('EV-1',category,'sale','10.00'),eventId,external,500,'eventpay').errors.length>0)
 }
 for(const category of ['bar','topups']){
  assert.ok(validateProviderTransactionCsv(header+row('EV-1',category,'sale','10.00'),eventId,external,500,'sumup').errors.length>0)
  assert.ok(validateProviderTransactionCsv(header+row('EV-1',category,'sale','10.00'),eventId,external,500,'eventix').errors.length>0)
 }
 assert.ok(validateProviderTransactionCsv(header+row('EV-1','bar','sale','10.00'),eventId,external,500,'unknown').errors.length>0)
})
test('EventPay topup liability is excluded from consumption revenue and no wallet mutation occurs',()=>{
 const rows=[
  payment('BAR-1','bar','order-1',350),
  payment('MERCH-1','merch','order-2',1675),
  payment('RELOAD-1','topups','load-1',2000),
  payment('BAR-REFUND','bar','order-1',150,'refunded'),
  payment('RELOAD-REFUND','topups','load-1',500,'refunded'),
 ]
 const r=buildSalesReconciliationReport(rows)
 assert.equal(r.totals.bar,200)
 assert.equal(r.totals.merch,1675)
 assert.equal(r.totals.topups,1500)
 assert.equal(r.events[0].netCents.topups,1500)
 assert.equal(r.totals.bar+r.totals.merch,1875)
 const csv=salesReconciliationCsv(r)
 assert.match(csv,/prepaid-liability/)
 assert.match(csv,/sale/)
 const bad=reconcileExternalSales([payment('X','tickets','sale-1',123)])
 assert.equal(bad.accepted.length,0)
 assert.equal(bad.conflicts.length,1)
})
test('duplicate, missing reference and unlinked refunds never inflate EventPay totals',()=>{
 const one=payment('BAR-1','bar','order-1',350)
 const r=reconcileExternalSales([
  one,one,payment('UNMATCHED','bar',null,250),
  payment('REF-ONLY','topups','unknown',200,'refunded'),
  payment('RELOAD-1','topups','load-1',2000)
 ])
 assert.equal(r.totals.bar,350)
 assert.equal(r.totals.topups,2000)
 assert.equal(r.duplicates.length,1)
 assert.equal(r.unmatched.length,1)
 assert.equal(r.conflicts.length,1)
})
test('database row decoder is provider-scoped and rejects topups from legacy providers',()=>{
 assert.equal(decodeProviderTransactions([stored('RELOAD-1','topups','load-1',2000)]).length,1)
 assert.throws(()=>decodeProviderTransactions([{
  ...stored('RELOAD-1','topups','load-1',2000),provider:'sumup'
 }]))
})
test('database refuses mixed-provider category records and never enables in-app payment processing',()=>{
 const migration=read('supabase/migrations/20261112062000_eventpay_readonly_statement_reconciliation.sql')
 assert.match(migration,/admin_provider_transactions_cashless_category_guard/)
 assert.match(migration,/provider='eventpay' AND category IN \('bar','merch','topups'\)/)
 assert.match(migration,/v_mapping\.provider='eventpay'/)
 assert.doesNotMatch(migration,/CREATE TABLE.*wallet|UPDATE public\.sales_transactions|SET balance=/i)
 const api=read('app/api/administration/provider-transactions/route.ts')
 assert.match(api,/validateProviderTransactionCsv\([^)]*mapping\.provider/)
 assert.match(api,/upt_import_admin_provider_transactions/)
 assert.doesNotMatch(api,/wallet|topupCharge|paymentIntent/i)
 const settlement=read('app/api/administration/provider-settlements/route.ts')
 assert.match(settlement,/\.in\('provider',\['eventix','sumup'\]\)/)
})
