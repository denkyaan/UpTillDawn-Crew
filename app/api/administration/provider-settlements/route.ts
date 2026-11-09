import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {parseCents,previewProviderSettlement,type SettlementTransaction} from '@/lib/administration/provider-bank-settlement'
export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const reply=(payload:unknown,status=200)=>NextResponse.json(payload,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
const asDb=(value:unknown)=>value as SupabaseClient
async function boundedJson(request:Request,maxBytes=32_000):Promise<unknown>{
 const reader=request.body?.getReader()
 if(!reader)throw Error('Missing body')
 const declared=request.headers.get('Content-Length')
 if(declared&&Number(declared)>maxBytes)throw Error('Too large')
 const chunks:Uint8Array[]=[]
 let total=0
 while(true){
  const {done,value}=await reader.read()
  if(done)break
  total+=value.byteLength
  if(total>maxBytes){await reader.cancel();throw Error('Too large')}
  chunks.push(value)
 }
 const buffer=new Uint8Array(total)
 let offset=0
 for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer))
}
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return reply({error:'access_denied'},access.status)
 const db=asDb(access.db)
 const [banks,provider,settlements,links,permission]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,booked_on,transaction_id,amount_cents,payment_reference,direction,currency,posted_payment_id,ignored_at',{count:'exact'})
   .eq('direction','credit').is('posted_payment_id',null).is('ignored_at',null)
   .order('booked_on',{ascending:false}).range(0,999),
  db.from('admin_provider_transactions')
   .select('id,event_id,provider,transaction_id,status,amount_cents,currency',{count:'exact'})
   .in('status',['paid','refunded']).order('occurred_at',{ascending:false}).range(0,1999),
  db.from('admin_provider_bank_settlements')
   .select('id,bank_statement_id,provider,event_id,gross_cents,fee_cents,payout_cents,note,approved_at',{count:'exact'})
   .order('approved_at',{ascending:false}).range(0,999),
  db.from('admin_provider_bank_settlement_items')
   .select('provider_transaction_id',{count:'exact'}).range(0,1999),
  access.db.rpc('upt_is_admin')
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
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:'access_denied'},access.status)
 const {data:canApprove,error:roleError}=await access.db.rpc('upt_is_admin')
 if(roleError)return reply({error:'permission_unavailable'},503)
 if(canApprove!==true)return reply({error:'admin_required'},403)
 let value:unknown
 try{value=await boundedJson(request)}catch{return reply({error:'invalid_request_or_size'},400)}
 if(!value||typeof value!=='object'||Array.isArray(value))return reply({error:'invalid_request'},422)
 const {statementId,transactionIds,feeCents,note}=value as Record<string,unknown>
 if(typeof statementId!=='string'||!uuid.test(statementId)||!Array.isArray(transactionIds)||
   transactionIds.length<1||transactionIds.length>500||transactionIds.some(id=>typeof id!=='string'||!uuid.test(id))||
   new Set(transactionIds).size!==transactionIds.length||parseCents(feeCents)===null||
   typeof note!=='string'||note.trim().length<10||note.trim().length>500)
  return reply({error:'invalid_settlement'},422)
 const db=asDb(access.db)
 const [bank,provider]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,direction,currency,amount_cents,posted_payment_id,ignored_at').eq('id',statementId).maybeSingle(),
  db.from('admin_provider_transactions')
   .select('id,event_id,provider,transaction_id,status,amount_cents,currency').in('id',transactionIds as string[])
 ])
 if(bank.error||provider.error||!bank.data||!provider.data)return reply({error:'settlement_source_unavailable'},503)
 const entries:SettlementTransaction[]=[]
 for(const row of provider.data){
  const amount=parseCents(row.amount_cents)
  if(amount===null||amount===0||row.currency!=='EUR'||!['paid','refunded'].includes(row.status)||
    !['sumup','eventix'].includes(row.provider))return reply({error:'invalid_provider_transaction'},422)
  entries.push({...row,provider:row.provider as SettlementTransaction['provider'],
   status:row.status as SettlementTransaction['status'],amount_cents:amount})
 }
 const preview=previewProviderSettlement(entries,Number(feeCents))
 const bankAmount=parseCents(bank.data.amount_cents)
 if(!preview||preview.transactionCount!==transactionIds.length||bankAmount===null||bankAmount!==preview.payoutCents||
   bank.data.direction!=='credit'||bank.data.currency!=='EUR'||bank.data.posted_payment_id||bank.data.ignored_at)
  return reply({error:'settlement_does_not_balance'},422)
 // Database rechecks every row and locks against concurrent posting/settlement.
 const {data,error}=await db.rpc('upt_admin_settle_provider_bank_statement',{
  p_statement:statementId,p_transactions:transactionIds,
  p_fee_cents:Number(feeCents),p_note:note.trim()
 })
 if(error)return reply({error:error.code==='23505'?'already_settled':
  error.code==='42501'?'admin_required':'settlement_rejected'},
  error.code==='23505'?409:error.code==='42501'?403:422)
 return reply({result:data})
}
