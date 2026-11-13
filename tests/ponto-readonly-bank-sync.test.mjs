import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {normalizePontoBankPage} from "../lib/administration/ponto-bank-normalizer.ts"

const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8")
const account="123e4567-e89b-42d3-a456-426614174000"
const tx="223e4567-e89b-42d3-a456-426614174000"
const transaction=(amount=24.20)=>({
 type:"transaction",id:tx,
 attributes:{amount,currency:"EUR",executionDate:"2026-11-13T08:15:00Z",description:"Bank charge",remittanceInformation:"INV-21"},
 relationships:{account:{data:{type:"account",id:account}}}
})
const wrap=(data,links={next:null})=>({data,links})

test("Ponto AIS booked EUR observations normalize to the existing bank review schema, not invoice payments",()=>{
 const result=normalizePontoBankPage(wrap([transaction()]),account)
 assert.deepEqual(result,{rows:[{
  transactionId:"ponto:"+account+":"+tx,bookedOn:"2026-11-13",direction:"credit",amountCents:2420,
  paymentReference:"INV-21",description:"Bank charge"
 }],next:null})
 const debit=normalizePontoBankPage(wrap([transaction(-4.35)]),account)
 assert.equal(debit.rows[0].direction,"debit")
 assert.equal(debit.rows[0].amountCents,435)
 assert.equal(debit.rows[0].transactionId,result.rows[0].transactionId)
})

test("Account consent is enforced independently for each transaction, with no cross-account mixing",()=>{
 assert.throws(()=>normalizePontoBankPage(wrap([transaction()]),"323e4567-e89b-42d3-a456-426614174000"),/ponto_account_mismatch/)
 const altered={...transaction(),relationships:{}}
 assert.throws(()=>normalizePontoBankPage(wrap([altered]),account),/ponto_account_mismatch/)
 for(const raw of [null,[],{},wrap([{type:"pendingTransaction",id:tx,attributes:transaction().attributes,relationships:transaction().relationships}])])
  assert.throws(()=>normalizePontoBankPage(raw,account))
})

test("Invalid amount, foreign currency, date and untrusted bank statement fields fail the entire batch",()=>{
 const mutate=fields=>({...transaction(),attributes:{...transaction().attributes,...fields}})
 const bad=[
  mutate({currency:"USD"}),mutate({amount:0}),mutate({amount:0.001}),mutate({amount:Infinity}),
  mutate({executionDate:"not-a-date"}),mutate({executionDate:"2026-02-30T10:00:00Z"}),
  mutate({remittanceInformation:"X".repeat(201)}),
  mutate({description:"Bad\u0000text"})
 ]
 for(const record of bad)assert.throws(()=>normalizePontoBankPage(wrap([transaction(),record]),account))
 assert.throws(()=>normalizePontoBankPage(wrap([transaction(),transaction()]),account),/invalid_ponto_row/)
})

test("Pagination permits only HTTPS fixed-host account-bound cursors and bounded data",()=>{
 const safe="https://api.myponto.com/accounts/"+account+"/transactions?page[limit]=100&page[after]="+tx
 assert.equal(normalizePontoBankPage(wrap([transaction()],{next:safe}),account).next,tx)
 for(const url of [
  "https://evil.example/accounts/"+account+"/transactions?page[limit]=100&page[after]="+tx,
  "https://api.myponto.com/accounts/323e4567-e89b-42d3-a456-426614174000/transactions?page[limit]=100&page[after]="+tx,
  safe+"&redirect=https://evil.example",safe.replace("https:","http:"),safe.replace(tx,"../../unsafe"),
 ])assert.throws(()=>normalizePontoBankPage(wrap([transaction()],{next:url}),account),/invalid_ponto_links/)
 assert.throws(()=>normalizePontoBankPage(wrap(Array.from({length:101},()=>transaction())),account),/invalid_ponto_page/)
})

test("Bank API only uses secure encrypted records, explicit same-origin POST and idempotent import RPC",()=>{
 const route=src("app/api/administration/ponto/sync/route.ts")
 const service=src("lib/administration/ponto-bank-sync.ts")
 const client=src("lib/administration/provider-connection-check.ts")
 const ui=src("components/administration/ponto-bank-sync.tsx")
 const workspace=src("components/administration/bank-statement-workspace.tsx")
 const sql=src("supabase/migrations/20261109070000_administration_bank_statement_invoice_matching.sql")
 for(const expected of [
  "requestHasSameOrigin(request)","integrationManagementAccess()",
  'getManagedIntegrationConfig(access.db,"banking")',
  'fetchPontoBankStatementRows(',
  'upt_admin_import_bank_statement_transactions'
 ])assert.ok(route.includes(expected),expected)
 assert.doesNotMatch(route,/upt_admin_post_bank_statement_payment|upt_admin_ignore_bank_statement|\\btransfer\\b|\\bsend_payment\\b/)
 assert.match(service,/pontoAccessToken\\(env\\)/)
 assert.match(service,/pontoReadOnlyJson/)
 assert.match(service,/normalizePontoBankPage/)
 assert.match(service,/allRows\.length>500/)
 assert.match(service,/if\\(!complete\\)throw Error/)
 assert.match(client,/url\.origin!=="https:\/\/api\.myponto\.com"/)
 assert.match(client,/method:"GET"/)
 assert.match(client,/safeMetadata\(result,maxBytes\)/)
 assert.match(sql,/on conflict \(transaction_id\) do nothing/)
 assert.match(sql,/upt_can_manage_administration\(\)/)
 assert.match(ui,/\/api\/administration\/ponto\/sync/)
 assert.match(workspace,/PontoBankSync locale=\{locale\} onImported=\{\(\)=>void refresh\(\)\}/)
 for(const locale of ["nl:","fr:","en:","de:"])assert.ok(ui.includes(locale),locale)
 assert.doesNotMatch(ui,/secret|apiKey|iban|accountReference|balance/i)
})
