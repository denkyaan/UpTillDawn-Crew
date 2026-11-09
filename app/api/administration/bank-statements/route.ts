import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {normalizeIban,reconcileBankStatementEntries,validateBankStatementCsv} from '@/lib/administration/bank-statement'

export const dynamic='force-dynamic'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
const dbClient=(value:unknown)=>value as SupabaseClient

export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return json({error:'access_denied'},access.status)
 const db=dbClient(access.db)
 const [entries,payments,documents,role]=await Promise.all([
  db.from('admin_bank_statement_entries')
   .select('id,bank_account_iban,transaction_reference,booking_date,amount_cents,counterparty_iban,description',{count:'exact'})
   .order('booking_date',{ascending:false}).order('id',{ascending:false}).range(0,999),
  db.from('admin_financial_payments')
   .select('id,document_id,amount,paid_on,bank_reference',{count:'exact'})
   .order('id',{ascending:false}).range(0,4999),
  db.from('admin_financial_documents')
   .select('id,kind,status,currency,document_number',{count:'exact'})
   .in('kind',['sales_invoice','purchase_invoice']).in('status',['approved','issued','paid']).order('id').range(0,4999),
  db.rpc('upt_is_admin')
 ])
 if(entries.error||payments.error||documents.error||role.error||
   entries.count===null||payments.count===null||documents.count===null||
   entries.count>1000||payments.count>5000||documents.count>5000||
   entries.data?.length!==entries.count||payments.data?.length!==payments.count||
   documents.data?.length!==documents.count)
  return json({error:'bank_reconciliation_unavailable_or_too_large'},503)
 const ids=entries.data!.map(row=>row.id)
 const matches=ids.length?await db.from('admin_bank_payment_matches')
   .select('id,entry_id,payment_id').in('entry_id',ids):{data:[],error:null}
 if(matches.error||!matches.data||matches.data.length>1000)return json({error:'bank_match_unavailable'},503)
 let suggestions
 try{suggestions=reconcileBankStatementEntries(
  entries.data!,payments.data!,documents.data!,matches.data
 )}catch{return json({error:'invalid_bank_reconciliation_data'},503)}
 return json({entries:entries.data,suggestions,canApprove:role.data===true,total:entries.count})
}

/** Bounded, normalized bank statement observation import. Does not create invoice payments. */
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return json({error:'access_denied'},access.status)
 const reader=request.body?.getReader()
 if(!reader)return json({error:'invalid_upload'},400)
 const chunks:Uint8Array[]=[];let length=0
 try{
  while(true){
   const part=await reader.read()
   if(part.done)break
   length+=part.value.byteLength
   if(length>600_000){await reader.cancel();return json({error:'file_too_large'},413)}
   chunks.push(part.value)
  }
 }catch{return json({error:'invalid_upload'},400)}
 const bytes=new Uint8Array(length)
 let offset=0
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 let form:FormData
 try{form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()}
 catch{return json({error:'invalid_upload'},400)}
 const file=form.get('file')
 const account=normalizeIban(String(form.get('bankAccountIban')??''))
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size===0)
  return json({error:'invalid_upload'},422)
 if(file.size>500_000)return json({error:'file_too_large'},413)
 const parsed=validateBankStatementCsv(await file.text(),account)
 if(parsed.errors.length)return json({error:'invalid_rows',errors:parsed.errors.slice(0,20)},422)
 const db=dbClient(access.db)
 const {data,error}=await db.rpc('upt_import_admin_bank_statement',{
  p_bank_account_iban:account,
  p_rows:parsed.rows
 })
 if(error)return json({error:error.code==='23505'?'conflicting_bank_entry':error.code==='42501'?'access_denied':'import_rejected'},
  error.code==='23505'?409:error.code==='42501'?403:422)
 if(!data||!Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)
  ||data.inserted+data.skipped!==parsed.rows.length)
  return json({error:'unexpected_import_result'},503)
 return json({result:data,netCents:parsed.netCents})
}
