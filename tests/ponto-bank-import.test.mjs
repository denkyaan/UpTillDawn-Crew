import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {normalizePontoTransactions} from "../lib/administration/ponto-import.ts"

const account="123e4567-e89b-42d3-a456-426614174000"
const another="223e4567-e89b-42d3-a456-426614174000"
const txid="323e4567-e89b-42d3-a456-426614174000"
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8")
const movement=(overrides={})=>({
 type:"transaction",id:txid,
 relationships:{account:{data:{type:"account",id:account}}},
 attributes:{amount:-99.01,currency:"EUR",description:"Invoice 123",remittanceInformation:"RF-001",
  valueDate:"2026-11-13T09:36:57.000Z",executionDate:"2026-11-13T10:45:24.000Z"},
 ...overrides
})
const body=(rows,link=null)=>({data:rows,links:{next:link}})

test("Ponto booked transactions map into the existing bank register without claiming an invoice payment",()=>{
 const result=normalizePontoTransactions(body([movement()]),account)
 assert.deepEqual(result.rows,[{
  transactionId:"PONTO:"+account+":"+txid,bookedOn:"2026-11-13",
  direction:"debit",amountCents:9901,paymentReference:"RF-001",description:"Invoice 123"
 }])
 assert.equal(result.nextCursor,null)
 const credit=normalizePontoTransactions(body([movement({attributes:{
  amount:10,currency:"EUR",description:"Deposit",endToEndId:"END-123",
  executionDate:"2026-11-12T08:00:00Z",valueDate:null
 }})]),account)
 assert.equal(credit.rows[0].direction,"credit")
 assert.equal(credit.rows[0].amountCents,1000)
 assert.equal(credit.rows[0].paymentReference,"END-123")
})

test("Provider cursor never becomes an attacker-controlled URL",()=>{
 const result=normalizePontoTransactions(body([movement()],"https://other.example/untrusted"),account)
 assert.equal(result.nextCursor,txid)
 const client=read("lib/administration/ponto-readonly.ts")
 assert.match(client,/page%5Bafter%5D=/)
 assert.match(client,/url\.origin!==host/)
 assert.match(client,/new URL\(path,host\)/)
 assert.doesNotMatch(client,/fetch\(.*links\.next/)
 assert.doesNotMatch(client,/synchronizations/)
})

test("Empty batch and duplicate/malformed provider identity fail safely",()=>{
 assert.deepEqual(normalizePontoTransactions(body([]),account),{rows:[],nextCursor:null})
 assert.throws(()=>normalizePontoTransactions(body([],"https://api.myponto.com/next"),account))
 assert.throws(()=>normalizePontoTransactions(body([movement(),movement()]),account))
 assert.throws(()=>normalizePontoTransactions(body([movement({type:"pendingTransaction"})]),account))
 assert.throws(()=>normalizePontoTransactions(body([movement({id:"evil/../url"})]),account))
 assert.throws(()=>normalizePontoTransactions(body([movement()]),"malformed-account"))
 assert.throws(()=>normalizePontoTransactions(body([movement({relationships:{account:{data:{id:another,type:"account"}}}})]),account))
 assert.throws(()=>normalizePontoTransactions(body(new Array(101).fill(movement())),account))
})

test("Non-EUR, fractional cents, invalid dates and control characters reject the entire batch",()=>{
 const attributes=movement().attributes
 for(const changed of [
  {currency:"USD"},{amount:0},{amount:1.001},{amount:Infinity},
  {description:"Bad\nImport"},{remittanceInformation:"Bad\u0000ref"},
  {valueDate:"2026-02-30T09:00:00Z"},{valueDate:"invalid-date"}
 ])assert.throws(()=>normalizePontoTransactions(body([movement({attributes:{...attributes,...changed}})]),account))
})

test("API enforces approved Admin/Administration credentials and exact account authorization",()=>{
 const route=read("app/api/administration/integrations/ponto/route.ts")
 const settings=read("lib/administration/integration-management-access.ts")
 const admin=read("app/(app)/portals/administration/modules/[slug]/page.tsx")
 const ui=read("components/administration/ponto-bank-import.tsx")
 const bank=read("components/administration/bank-statement-workspace.tsx")
 const sql=read("supabase/migrations/20261109070000_administration_bank_statement_invoice_matching.sql")
 assert.match(route,/integrationManagementAccess\(\)/)
 assert.match(route,/requestHasSameOrigin\(request\)/)
 assert.match(route,/getManagedIntegrationConfig\(access\.db,"banking"\)/)
 assert.match(route,/allowed\.includes\(data\.accountId\)/)
 assert.match(route,/n>256/)
 assert.match(route,/upt_admin_import_bank_statement_transactions/)
 assert.match(route,/inserted\+skipped!==page\.rows\.length/)
 assert.doesNotMatch(route,/upt_admin_post_bank_statement_payment|upt_admin_link_existing_bank_statement_payment|createPayment|initiateTransfer/)
 assert.match(settings,/upt_can_manage_integrations/)
 assert.match(admin,/slug==="banking"&&pontoSetupAccess\?\.ok&&<PontoBankImport/)
 assert.match(ui,/uptilldawn-ponto-imported/)
 assert.match(bank,/window\.addEventListener\("uptilldawn-ponto-imported"/)
 assert.match(sql,/on conflict \(transaction_id\) do nothing/)
 assert.match(sql,/Conflicting bank statement transaction/)
})

test("Batch continuation and final accounting remain deliberate operator actions",()=>{
 const ui=read("components/administration/ponto-bank-import.tsx")
 const route=read("app/api/administration/integrations/ponto/route.ts")
 assert.match(ui,/nextCursor/)
 assert.match(ui,/next\.inserted>0/)
 assert.match(ui,/setCursor\(next\.nextCursor\)/)
 assert.match(route,/const page=await pontoBookedPage/)
 assert.match(route,/page\.nextCursor/)
 const dbRoute=read("app/api/administration/bank-statements/route.ts")
 assert.match(dbRoute,/upt_is_admin/)
 assert.match(dbRoute,/upt_admin_post_bank_statement_payment/)
})
