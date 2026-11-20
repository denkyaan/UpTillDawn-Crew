import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {validateProviderTransactionCsv} from '@/lib/administration/provider-transaction-import'
import {reportProviderTransactions} from '@/lib/administration/provider-transaction-report'
import {salesReconciliationCsv,salesReconciliationExceptionsCsv} from '@/lib/administration/sales-reconciliation-report'

export const dynamic='force-dynamic'
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const dbClient=(db:unknown)=>db as SupabaseClient

/** Only authenticated Administration reads may see transaction references and exceptions. */
export async function GET(request:Request){
 const access=await administrationAccess()
 if(!access.ok)return reply({error:'access_denied'},access.status)
 const format=new URL(request.url).searchParams.get('export')
 if(format!==null&&!['net','exceptions'].includes(format))return reply({error:'invalid_export'},400)
 const {data,error,count}=await dbClient(access.db)
  .from('admin_provider_transactions')
  .select('id,event_id,provider,transaction_id,category,sale_reference,status,amount_cents,currency,occurred_at',{count:'exact'})
  .order('occurred_at',{ascending:false}).order('id',{ascending:false}).range(0,5000)
 if(error||!data||count===null||count>5000||data.length!==count)
  return reply({error:'reconciliation_unavailable_or_too_large'},503)
 let report
 try{report=reportProviderTransactions(data)}catch{return reply({error:'invalid_reconciliation_data'},503)}
 if(!format)return reply({report,transactionCount:data.length})
 const csv=format==='net'?salesReconciliationCsv(report):salesReconciliationExceptionsCsv(report)
 const filename=format==='net'?'provider-sales-reconciliation.csv':'provider-sales-exceptions.csv'
 return new NextResponse(csv,{headers:{
  'Content-Type':'text/csv; charset=utf-8',
  'Content-Disposition':'attachment; filename="'+filename+'"',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
 }})
}

/** All-or-nothing import. No invoice, payout, cash or inventory mutation is performed. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:'access_denied'},access.status)
 const reader=request.body?.getReader()
 if(!reader)return reply({error:'invalid_file'},400)
 const chunks:Uint8Array[]=[]
 let length=0
 try{
  while(true){
   const part=await reader.read()
   if(part.done)break
   length+=part.value.byteLength
   if(length>1_100_000){await reader.cancel();return reply({error:'file_too_large'},413)}
   chunks.push(part.value)
  }
 }catch{return reply({error:'invalid_file'},400)}
 const bytes=new Uint8Array(length)
 let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 let form:FormData
 try{form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()}
 catch{return reply({error:'invalid_file'},400)}
 const file=form.get('file'),mappingId=String(form.get('mappingId')??'')
 if(!uuid.test(mappingId)||!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size===0)
  return reply({error:'invalid_import'},422)
 if(file.size>1_000_000)return reply({error:'file_too_large'},413)
 const {data:mapping,error:mappingError}=await access.db.from('admin_provider_event_mappings')
  .select('id,event_id,external_event_id,provider,enabled').eq('id',mappingId).eq('enabled',true).maybeSingle()
 if(mappingError)return reply({error:'mapping_unavailable'},503)
 if(!mapping||!['eventix','sumup','eventpay'].includes(mapping.provider))return reply({error:'mapping_inactive'},409)
 const parsed=validateProviderTransactionCsv(await file.text(),mapping.event_id,mapping.external_event_id,500,mapping.provider as 'eventix'|'sumup'|'eventpay')
 if(parsed.errors.length)return reply({error:'invalid_rows',errors:parsed.errors.slice(0,20)},422)
 // SQL derives event/provider from the locked mapping, even if a caller bypasses this API.
 const {data,error}=await dbClient(access.db).rpc('upt_import_admin_provider_transactions',{
  p_mapping:mapping.id,
  p_rows:parsed.rows.map(row=>({
   transactionId:row.transactionId,category:row.category,saleReference:row.saleReference,
   status:row.status,amountCents:row.amountCents,occurredAt:row.occurredAt
  }))
 })
 if(error)return reply({error:error.code==='23505'?'conflicting_transaction':error.code==='42501'?'mapping_inactive':'import_rejected'},
  error.code==='23505'?409:error.code==='42501'?403:422)
 if(!data||!Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)
  ||data.inserted+data.skipped!==parsed.rows.length)return reply({error:'unexpected_import_result'},503)
 return reply({result:data,preview:{paidCents:parsed.paidCents,refundedCents:parsed.refundedCents,pendingCount:parsed.pendingCount}})
}
