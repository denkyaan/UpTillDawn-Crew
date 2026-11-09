import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateProviderTransactionCsv} from '../lib/administration/provider-transaction-import.ts'
import {decodeProviderTransactions,reportProviderTransactions} from '../lib/administration/provider-transaction-report.ts'
import {salesReconciliationCsv,salesReconciliationExceptionsCsv} from '../lib/administration/sales-reconciliation-report.ts'

const eventId='123e4567-e89b-42d3-a456-426614174000',external='eve:festival-2026'
const header='transaction_id,external_event_id,category,sale_reference,status,amount,currency,occurred_at\n'
const row=(transaction='PAY-001',status='paid',amount='30.00',externalEvent=external)=>
 transaction+','+externalEvent+',tickets,ORDER-1,'+status+','+amount+',EUR,2026-11-09T20:00:00+01:00\n'
const stored=(overrides={})=>({
 id:'223e4567-e89b-42d3-a456-426614174000',event_id:eventId,provider:'eventix',
 transaction_id:'PAY-001',category:'tickets',sale_reference:'ORDER-1',status:'paid',
 amount_cents:'3000',currency:'EUR',occurred_at:'2026-11-09T19:00:00.000Z',...overrides
})
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')

test('provider transaction CSV validates paid + refunds without rounding and normalizes internal event',()=>{
 const parsed=validateProviderTransactionCsv(header+row()+row('REF-001','refunded','5.13'),eventId,external)
 assert.deepEqual(parsed.errors,[])
 assert.equal(parsed.rows.length,2)
 assert.equal(parsed.paidCents,3000)
 assert.equal(parsed.refundedCents,513)
 assert.equal(parsed.rows[0].eventId,eventId)
 assert.equal(parsed.rows[0].occurredAt,'2026-11-09T19:00:00.000Z')
})
test('pending snapshots can precede their final paid state using one stable transaction ID',()=>{
 const parsed=validateProviderTransactionCsv(header+row('PAY-001','pending')+row('PAY-001','paid'),eventId,external)
 assert.equal(parsed.errors.length,0)
 assert.equal(parsed.pendingCount,1)
 assert.equal(parsed.paidCents,3000)
})
test('invalid or mixed provider events reject all rows atomically',()=>{
 for(const second of [
  row('PAY-002','paid','30.00','wrong-event'),
  row('PAY-002','paid','30.00',external).replace('EUR','USD'),
  row('PAY-002','paid','30.001'),
  row('PAY-002','paid','0.00'),
  row('PAY-002','paid','30.00').replace('2026-11-09','2026-02-30'),
  row('PAY-001','paid','30.00'),
  row('=FORMULA','paid','30.00'),
 ]){
  const parsed=validateProviderTransactionCsv(header+row()+second,eventId,external)
  assert.ok(parsed.errors.length>0)
  assert.deepEqual(parsed.rows,[])
  assert.equal(parsed.paidCents,0)
 }
})
test('rejects zero-row files, malformed quotes, wrong columns, unsafe mapping and limits',()=>{
 for(const csv of [header,'bad\n',header+row().replace('PAY-001','"broken'),header.replace('external_event_id','event_id')+row()]){
  assert.ok(validateProviderTransactionCsv(csv,eventId,external).errors.length)
 }
 assert.ok(validateProviderTransactionCsv(header+row(),'bad-uuid',external).errors.length)
 assert.ok(validateProviderTransactionCsv(header+row(),eventId,'../external').errors.length)
 assert.ok(validateProviderTransactionCsv(header+row(),eventId,external,0).errors.length)
 assert.ok(validateProviderTransactionCsv(header+row(),eventId,external,1).errors.length===0)
 assert.ok(validateProviderTransactionCsv(header+row()+row('PAY-002'),eventId,external,1).errors.length)
})
test('report reconciles paid and refunds, including prior-to-sale refund delivery',()=>{
 const input=[
  stored({id:'323e4567-e89b-42d3-a456-426614174000',transaction_id:'REF-001',status:'refunded',amount_cents:'500'}),
  stored()
 ]
 const report=reportProviderTransactions(input)
 assert.equal(report.totals.tickets,2500)
 assert.equal(report.events.length,1)
 assert.equal(report.events[0].refundedCents.tickets,500)
 assert.equal(report.exceptions.conflicts.length,0)
 assert.match(salesReconciliationCsv(report),/2500/)
})
test('unmatched refunds and unmatched transactions never inflate booked report totals',()=>{
 const entries=[
  stored({id:'423e4567-e89b-42d3-a456-426614174000',transaction_id:'REF-ONLY',status:'refunded',amount_cents:'700'}),
  stored({id:'523e4567-e89b-42d3-a456-426614174000',transaction_id:'NO-REF',sale_reference:null})
 ]
 const report=reportProviderTransactions(entries)
 assert.equal(report.totals.tickets,0)
 assert.equal(report.exceptions.conflicts.length,1)
 assert.equal(report.exceptions.unmatched.length,1)
 assert.match(salesReconciliationExceptionsCsv(report),/REF-ONLY/)
})
test('fail closed on duplicate snapshots and malformed database financial records',()=>{
 assert.throws(()=>decodeProviderTransactions([stored(),stored({id:'623e4567-e89b-42d3-a456-426614174000'})]))
 for(const value of [stored({amount_cents:'1.1'}),stored({amount_cents:9007199254740992}),
   stored({currency:'USD'}),stored({event_id:'wrong'}),stored({sale_reference:'=cmd'}),
   stored({status:'void'}),stored({transaction_id:''}),null]){
  assert.throws(()=>decodeProviderTransactions([value]))
 }
 assert.throws(()=>decodeProviderTransactions(null))
})
test('provider API enforces administration access, origin, bounded upload, active mapping and report completeness',()=>{
 const api=read('../app/api/administration/provider-transactions/route.ts')
 assert.match(api,/sameOrigin\(request\)/)
 assert.match(api,/administrationAccess\(\)/)
 assert.match(api,/length>1_100_000/)
 assert.match(api,/mappingId/)
 assert.match(api,/admin_provider_event_mappings/)
 assert.match(api,/\.eq\('enabled',true\)/)
 assert.match(api,/upt_import_admin_provider_transactions/)
 assert.match(api,/count>5000\|\|data\.length!==count/)
 assert.match(api,/salesReconciliationExceptionsCsv/)
 assert.doesNotMatch(api,/\.from\('admin_financial_payments'\)\.insert/)
})
test('database is append-only with RLS, authorized RPC, locked mapping, idempotency and atomic conflict rejection',()=>{
 const sql=read('../supabase/migrations/20261109063000_administration_provider_transaction_reconciliation.sql')
 assert.match(sql,/enable row level security/)
 assert.match(sql,/revoke all on public\.admin_provider_transactions from public,anon,authenticated/)
 assert.match(sql,/grant select on public\.admin_provider_transactions to authenticated/)
 assert.match(sql,/public\.upt_can_manage_administration\(\)/)
 assert.match(sql,/auth\.uid\(\) is null/)
 assert.match(sql,/where id=p_mapping and enabled=true for share/)
 assert.match(sql,/on conflict \(provider,transaction_id,status\) do nothing/)
 assert.match(sql,/errcode='23505'/)
 assert.match(sql,/p_rows jsonb/)
 assert.match(sql,/jsonb_array_length\(p_rows\) not between 1 and 500/)
 assert.match(sql,/grant execute on function public\.upt_import_admin_provider_transactions\(uuid,jsonb\) to authenticated/)
})
test('administration Banking integrates live register and downloadable exception reports in four UI languages',()=>{
 const page=read('../app/(app)/portals/administration/modules/[slug]/page.tsx')
 const component=read('../components/administration/provider-transaction-workspace.tsx')
 assert.match(page,/ProviderTransactionWorkspace/)
 assert.match(page,/slug==="banking"/)
 for(const locale of ['nl','fr','en','de'])assert.match(component,new RegExp('\\b'+locale+':\\{title:'))
 assert.match(component,/validateProviderTransactionCsv/)
 assert.match(component,/\/api\/administration\/provider-transactions/)
 assert.match(component,/export=net/)
 assert.match(component,/export=exceptions/)
 assert.match(component,/sale_reference/)
})
