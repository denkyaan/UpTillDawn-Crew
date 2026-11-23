// Native source-exact READ-only bank and provider settlement registers.
// Original SQL/RLS, count caps, amounts, transforms and responses preserved
// from app/api/administration/{bank-statements,provider-settlements}/route.ts.
// Worker must verify the original signed session AND upt_can_manage_administration.
import type {SupabaseClient} from "@supabase/supabase-js"
import {financialAmountCents} from "../../../lib/administration/finance-reconciliation.ts"
import {parseCents} from "../../../lib/administration/provider-bank-settlement.ts"
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
export async function nativeBankStatementRegister(db:SupabaseClient){
 const [statementResult,invoiceResult,paymentResult,settlementResult,permission]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,transaction_id,booked_on,direction,amount_cents,currency,payment_reference,description,linked_document_id,posted_payment_id,ignored_at,ignored_reason',{count:'exact'})
   .order('booked_on',{ascending:false}).order('id',{ascending:false}).range(0,999),
  db.from('admin_financial_documents')
   .select('id,document_number,kind,status,currency',{count:'exact'})
   .in('kind',['sales_invoice','purchase_invoice']).in('status',['approved','issued','paid'])
   .order('created_at',{ascending:false}).limit(500),
  db.from('admin_financial_payments')
   .select('id,document_id,amount,paid_on,bank_reference',{count:'exact'})
   .order('created_at',{ascending:false}).range(0,1999),
  db.from('admin_provider_bank_settlements').select('bank_statement_id',{count:'exact'}).range(0,999),
  db.rpc('upt_is_admin')
 ])
 const {data:statements,error:statementsError,count:statementCount}=statementResult
 const {data:documents,error:documentsError,count:invoiceCount}=invoiceResult
 const {data:payments,error:paymentsError,count:paymentCount}=paymentResult
 const {data:providerSettlements,error:settlementError,count:settlementCount}=settlementResult
 if(statementsError||statements===null||statementCount===null||statementCount>1000||statements.length!==statementCount
   ||documentsError||documents===null||invoiceCount===null||invoiceCount>500||documents.length!==invoiceCount
   ||paymentsError||payments===null||paymentCount===null||paymentCount>2000||payments.length!==paymentCount
   ||settlementError||providerSettlements===null||settlementCount===null||settlementCount>1000||providerSettlements.length!==settlementCount)
  return response({error:'statement_or_invoice_data_unavailable'},503)
 const ids=documents.map(document=>document.id)
 let balances:{document_id:string;outstanding_amount:unknown}[]=[]
 if(ids.length){
  const result=await db.from('admin_financial_payment_balances')
   .select('document_id,outstanding_amount',{count:'exact'}).in('document_id',ids).limit(500)
  if(result.error||result.data===null||result.count!==ids.length||result.data.length!==ids.length)
   return response({error:'invoice_balance_data_unavailable'},503)
  balances=result.data
 }
 const byId=new Map<string,number>()
 try{
  for(const item of balances){
   if(typeof item.document_id!=='string'||!uuid.test(item.document_id)||byId.has(item.document_id))throw Error('Duplicate balance')
   byId.set(item.document_id,financialAmountCents(item.outstanding_amount))
  }
  const outputDocuments=documents.map(document=>{
   if(typeof document.id!=='string'||!uuid.test(document.id)||document.currency!=='EUR'
      ||!['approved','issued','paid'].includes(document.status)
      ||!['sales_invoice','purchase_invoice'].includes(document.kind))throw Error('Invalid invoice')
   const outstandingCents=byId.get(document.id)
   if(outstandingCents===undefined)throw Error('Missing balance')
   return {
    id:document.id,number:document.document_number??document.id,
    kind:document.kind,outstandingCents
   }
  }).filter(document=>document.outstandingCents>0&&
    ['approved','issued'].includes(documents.find(row=>row.id===document.id)?.status??''))
  const settledBankIds=new Set(providerSettlements.map(row=>row.bank_statement_id))
  const outputStatements=statements.map(statement=>{
   const raw=statement.amount_cents
   if((typeof raw!=='number'&&typeof raw!=='string')||!/^[1-9][0-9]{0,10}$/.test(String(raw))
    ||!Number.isSafeInteger(Number(raw))||Number(raw)>99_999_999_999
    ||typeof statement.id!=='string'||!uuid.test(statement.id)
    ||!['credit','debit'].includes(statement.direction)||statement.currency!=='EUR'
    ||typeof statement.transaction_id!=='string'||typeof statement.booked_on!=='string')
    throw Error('Invalid bank record')
   return {...statement,amount_cents:Number(raw),provider_settled:settledBankIds.has(statement.id)}
  })
  const eligibleDocuments=new Map(documents.map(document=>[document.id,document]))
  const existingPayments=payments.flatMap(payment=>{
   const document=eligibleDocuments.get(payment.document_id)
   if(!document||typeof payment.bank_reference!=='string'||!payment.bank_reference||
      payment.bank_reference.startsWith('BANKSTMT:'))return []
   if(typeof payment.id!=='string'||!uuid.test(payment.id)||
      typeof payment.paid_on!=='string'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(payment.paid_on))
    throw Error('Invalid existing payment')
   return [{id:payment.id,documentId:payment.document_id,
    documentNumber:document.document_number??document.id,
    amountCents:financialAmountCents(payment.amount),paidOn:payment.paid_on,
    bankReference:payment.bank_reference,kind:document.kind}]
  })
  return response({statements:outputStatements,invoices:outputDocuments,existingPayments,
   canApprove:!permission.error&&permission.data===true})
 }catch{return response({error:'invalid_bank_reconciliation_data'},503)}
}
/** Store claimed bank transactions; never mark an invoice paid without a separate Admin decision. */
export async function nativeProviderSettlementRegister(db:SupabaseClient){
 const [banks,provider,settlements,links,permission]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,booked_on,transaction_id,amount_cents,payment_reference,direction,currency,posted_payment_id,ignored_at',{count:'exact'})
   .eq('direction','credit').is('posted_payment_id',null).is('ignored_at',null)
   .order('booked_on',{ascending:false}).range(0,999),
  db.from('admin_provider_transactions')
   .select('id,event_id,provider,transaction_id,status,amount_cents,currency',{count:'exact'})
    .in('provider',['eventix','sumup']).in('status',['paid','refunded']).order('occurred_at',{ascending:false}).range(0,1999),
  db.from('admin_provider_bank_settlements')
   .select('id,bank_statement_id,provider,event_id,gross_cents,fee_cents,payout_cents,note,approved_at',{count:'exact'})
   .order('approved_at',{ascending:false}).range(0,999),
  db.from('admin_provider_bank_settlement_items')
   .select('provider_transaction_id',{count:'exact'}).range(0,1999),
  db.rpc('upt_is_admin')
 ])
 if(banks.error||provider.error||settlements.error||links.error||permission.error||
    banks.data===null||provider.data===null||settlements.data===null||links.data===null||
    banks.count===null||provider.count===null||settlements.count===null||links.count===null||
    banks.count>1000||provider.count>2000||settlements.count>1000||links.count>2000||
    banks.data.length!==banks.count||provider.data.length!==provider.count||
    settlements.data.length!==settlements.count||links.data.length!==links.count)
  return reply({error:'settlement_register_incomplete'},503)
 try{
  const settledBanks=new Set(settlements.data.map(row=>row.bank_statement_id))
  const settledTransactions=new Set(links.data.map(row=>row.provider_transaction_id))
  const bankStatements=banks.data.filter(row=>!settledBanks.has(row.id)).map(row=>{
   const amount=parseCents(row.amount_cents)
   if(amount===null||amount===0||!uuid.test(row.id)||row.currency!=='EUR')throw Error('Invalid bank row')
   return {id:row.id,booked_on:row.booked_on,transaction_id:row.transaction_id,
    amount_cents:amount,payment_reference:row.payment_reference}
  })
  const transactions=provider.data.filter(row=>!settledTransactions.has(row.id)).map(row=>{
   const amount=parseCents(row.amount_cents)
   if(amount===null||amount===0||!uuid.test(row.id)||!uuid.test(row.event_id)||row.currency!=='EUR'||
      !['eventix','sumup'].includes(row.provider)||!['paid','refunded'].includes(row.status))throw Error('Invalid provider row')
   return {id:row.id,event_id:row.event_id,provider:row.provider,
    transaction_id:row.transaction_id,status:row.status,amount_cents:amount}
  })
  return reply({bankStatements,transactions,settlements:settlements.data,canApprove:permission.data===true})
 }catch{return reply({error:'invalid_settlement_register'},503)}
}
