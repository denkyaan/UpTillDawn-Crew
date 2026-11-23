// Exact original bank imports / settlement approval mutations.
// Access is separately signed and checked by Worker. The authoritative
// PL/pgSQL RPCs enforce Admin approval, row locks, audit and idempotency.
import type {SupabaseClient} from "@supabase/supabase-js"
import {readBoundedFormData} from "../../../lib/bounded-form-data.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {validateBankStatementCsv} from "../../../lib/administration/bank-statement-import.ts"
import {parseCents,previewProviderSettlement,type SettlementTransaction} from "../../../lib/administration/provider-bank-settlement.ts"
import {sameOriginMutation} from "./native-admin-document-routes.ts"
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
export async function nativeBankStatementImport(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return response({error:'forbidden'},403)
 const form=await readBoundedFormData(request,1_100_000).catch(()=>null)
 const file=form?.get('file')
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size===0)
  return response({error:'invalid_file_or_size'},422)
 if(file.size>1_000_000)return response({error:'file_too_large'},413)
 const parsed=validateBankStatementCsv(await file.text())
 if(parsed.errors.length)return response({error:'invalid_bank_rows',errors:parsed.errors.slice(0,20)},422)
 const {data,error}=await db.rpc('upt_admin_import_bank_statement_transactions',{p_rows:parsed.rows})
 if(error)return response({error:error.code==='23505'?'conflicting_transaction':
    error.code==='42501'?'access_denied':'import_rejected'},error.code==='23505'?409:error.code==='42501'?403:422)
 if(!data||!Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)
   ||data.inserted+data.skipped!==parsed.rows.length)
  return response({error:'unexpected_import_result'},503)
 return response({result:data,preview:{creditCents:parsed.creditCents,debitCents:parsed.debitCents}})
}
/** Final accounting entries require an explicit Admin click and SQL-enforced permission. */
export async function nativeBankStatementReview(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return response({error:'forbidden'},403)
 const {data:canApprove,error:roleError}=await db.rpc('upt_is_admin')
 if(roleError)return response({error:'approval_permission_unavailable'},503)
 if(canApprove!==true)return response({error:'admin_required'},403)
 let body:unknown
 try{body=await readStrictJson(request,4096)}catch{return response({error:'invalid_request'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'invalid_request'},422)
 const {action,statementId,documentId,paymentId,reason}=body as Record<string,unknown>
 if(typeof statementId!=='string'||!uuid.test(statementId))return response({error:'invalid_statement'},422)
 let result
 if(action==='post'&&typeof documentId==='string'&&uuid.test(documentId)){
  result=await db.rpc('upt_admin_post_bank_statement_payment',{
   p_statement:statementId,p_document:documentId
  })
 }else if(action==='link'&&typeof paymentId==='string'&&uuid.test(paymentId)){
  result=await db.rpc('upt_admin_link_existing_bank_statement_payment',{
   p_statement:statementId,p_payment:paymentId
  })
 }else if(action==='ignore'&&typeof reason==='string'&&reason.trim().length>=5&&reason.trim().length<=500){
  result=await db.rpc('upt_admin_ignore_bank_statement',{
   p_statement:statementId,p_reason:reason.trim()
  })
 }else return response({error:'invalid_action'},422)
 if(result.error)return response({error:result.error.code==='23505'?'already_resolved':
    result.error.code==='42501'?'admin_required':'match_rejected'},
  result.error.code==='23505'?409:result.error.code==='42501'?403:422)
 return response({result:result.data})
}

export async function nativeProviderSettlementApprove(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return reply({error:'forbidden'},403)
 const {data:canApprove,error:roleError}=await db.rpc('upt_is_admin')
 if(roleError)return reply({error:'permission_unavailable'},503)
 if(canApprove!==true)return reply({error:'admin_required'},403)
 let value:unknown
 try{value=await readStrictJson(request,32_000)}catch{return reply({error:'invalid_request_or_size'},400)}
 if(!value||typeof value!=='object'||Array.isArray(value))return reply({error:'invalid_request'},422)
 const {statementId,transactionIds,feeCents,note}=value as Record<string,unknown>
 if(typeof statementId!=='string'||!uuid.test(statementId)||!Array.isArray(transactionIds)||
   transactionIds.length<1||transactionIds.length>500||transactionIds.some(id=>typeof id!=='string'||!uuid.test(id))||
   new Set(transactionIds).size!==transactionIds.length||parseCents(feeCents)===null||
   typeof note!=='string'||note.trim().length<10||note.trim().length>500)
  return reply({error:'invalid_settlement'},422)
 const [bank,provider]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,direction,currency,amount_cents,posted_payment_id,ignored_at').eq('id',statementId).maybeSingle(),
  db.from('admin_provider_transactions')
   .select('id,event_id,provider,transaction_id,status,amount_cents,currency').in('id',transactionIds as string[]).in('provider',['eventix','sumup'])
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

