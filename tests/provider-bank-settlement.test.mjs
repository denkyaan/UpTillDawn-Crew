import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseCents,parseEuroFee,previewProviderSettlement} from '../lib/administration/provider-bank-settlement.ts'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const event='11111111-1111-4111-8111-111111111111'
const tx=(id,status,amount_cents,provider='sumup',event_id=event)=>({id,transaction_id:'P-'+id,provider,event_id,status,amount_cents})
const a=tx('22222222-2222-4222-8222-222222222222','paid',4500)
const b=tx('33333333-3333-4333-8333-333333333333','refunded',500)
test('payout calculation uses exact EUR cents and accounts for refunds and fees',()=>{
 assert.deepEqual(previewProviderSettlement([a,b],125),{provider:'sumup',eventId:event,transactionCount:2,providerNetCents:4000,feeCents:125,payoutCents:3875})
 assert.equal(parseEuroFee('1,25'),125)
 assert.equal(parseEuroFee('2.05'),205)
 assert.equal(parseEuroFee('0'),0)
 assert.equal(parseCents('99999999999'),99999999999)
})
test('invalid, duplicate, mixed provider, wrong event, empty and negative net fail closed',()=>{
 for(const value of [[],[a,a],[a,{...b,provider:'eventix'}],[a,{...b,event_id:'55555555-5555-4555-8555-555555555555'}],
  [{...a,status:'pending'}],[{...a,amount_cents:-1}],[{...a,amount_cents:1.1}],[b]]){
  assert.equal(previewProviderSettlement(value,0),null)
 }
 assert.equal(previewProviderSettlement([a],4500),null)
 assert.equal(previewProviderSettlement([a],-1),null)
 assert.equal(previewProviderSettlement([a],1.1),null)
 for(const value of ['-1','1.234','01.00','1e3','NaN','Infinity','', '1,234'])assert.equal(parseEuroFee(value),null)
})
test('settlements require Admin confirmation, row locks and immutable audit records',()=>{
 const sql=read('supabase/migrations/20261109120000_admin_provider_bank_settlements.sql')
 for(const value of ['for update','upt_is_admin(v_actor)','upt_is_approved()','cardinality(p_transactions)',
  'admin_provider_bank_settlement_items','unique references public.admin_provider_transactions',
  'v_bank.posted_payment_id is not null','v_bank.ignored_at is not null',
  "v_bank.direction<>'credit'",'v_bank.amount_cents<>v_net-v_fee',
  'prevent_resolving_provider_settled_bank_row','upt_can_manage_administration()',
  'revoke all on public.admin_provider_bank_settlements'])assert.ok(sql.includes(value),value)
 assert.doesNotMatch(sql,/grant (?:all|insert|update|delete) on public\.admin_provider_bank_settlement_items to authenticated/)
})
test('API rejects cross-site writes, validates bounded input and calls auditable SQL without posting invoices',()=>{
 const route=read('app/api/administration/provider-settlements/route.ts')
 for(const value of ['administrationAccess','sameOrigin(request)','upt_is_admin',
  'upt_admin_settle_provider_bank_statement','previewProviderSettlement','transactionCount',
  'maxBytes','Content-Length'])assert.ok(route.includes(value),value)
 assert.doesNotMatch(route,/\.from\('admin_financial_payments'\)\.insert/)
})
test('Banking shows Admin-only provider settlement with translated preview and count',()=>{
 const page=read('app/(app)/portals/administration/modules/[slug]/page.tsx')
 const ui=read('components/administration/provider-bank-settlement-workspace.tsx')
 assert.match(page,/ProviderBankSettlementWorkspace/)
 for(const locale of ['nl','fr','en','de'])assert.ok(ui.includes(locale+':{title:'))
 assert.match(ui,/previewProviderSettlement/)
 assert.match(ui,/window\.confirm/)
 assert.match(ui,/canApprove/)
 assert.match(ui,/setSelectedIds/)
})
