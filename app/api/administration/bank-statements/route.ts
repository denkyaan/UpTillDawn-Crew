import {NextResponse} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {financialAmountCents} from '@/lib/administration/finance-reconciliation'
import {validateBankStatementCsv} from '@/lib/administration/bank-statement-import'

export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}})
const client=(db:unknown)=>db as SupabaseClient
/** Bounded upload reader: Content-Length and client-side checks are not security controls. */
async function multipart(request:Request,maxBytes:number):Promise<FormData|null>{
 const reader=request.body?.getReader()
 if(!reader)return null
 let count=0
 const chunks:Uint8Array[]=[]
 try{
  while(true){
   const next=await reader.read()
   if(next.done)break
   count+=next.value.byteLength
   if(count>maxBytes){await reader.cancel();return null}
   chunks.push(next.value)
  }
  const buffer=new Uint8Array(count)
  let offset=0
  for(const part of chunks){buffer.set(part,offset);offset+=part.byteLength}
  return await new Response(buffer,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()
 }catch{return null}
}
async function jsonRequest(request:Request,maxBytes=4096):Promise<unknown>{
 const reader=request.body?.getReader()
 if(!reader)throw Error('Missing body')
 let count=0
 const chunks:Uint8Array[]=[]
 while(true){
  const next=await reader.read()
  if(next.done)break
  count+=next.value.byteLength
  if(count>maxBytes){await reader.cancel();throw Error('Request too large')}
  chunks.push(next.value)
 }
 const bytes=new Uint8Array(count)
 let offset=0
 for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
/** Read-only authenticated statement register and outstanding invoice candidates. */
export async function GET(){
 const access=await administrationAccess()
 if(!access.ok)return response({error:'access_denied'},access.status)
 const db=client(access.db)
 const [statementResult,invoiceResult,permission]=await Promise.all([
  db.from('admin_bank_statement_transactions')
   .select('id,transaction_id,booked_on,direction,amount_cents,currency,payment_reference,description,linked_document_id,posted_payment_id,ignored_at,ignored_reason',{count:'exact'})
   .order('booked_on',{ascending:false}).order('id',{ascending:false}).range(0,999),
  db.from('admin_financial_documents')
   .select('id,document_number,kind,status,currency',{count:'exact'})
   .in('kind',['sales_invoice','purchase_invoice']).in('status',['approved','issued'])
   .order('created_at',{ascending:false}).limit(500),
  access.db.rpc('upt_is_admin')
 ])
 const {data:statements,error:statementsError,count:statementCount}=statementResult
 const {data:documents,error:documentsError,count:invoiceCount}=invoiceResult
 if(statementsError||statements===null||statementCount===null||statementCount>1000||statements.length!==statementCount
   ||documentsError||documents===null||invoiceCount===null||invoiceCount>500||documents.length!==invoiceCount)
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
      ||!['approved','issued'].includes(document.status)
      ||!['sales_invoice','purchase_invoice'].includes(document.kind))throw Error('Invalid invoice')
   const outstandingCents=byId.get(document.id)
   if(outstandingCents===undefined)throw Error('Missing balance')
   return {
    id:document.id,number:document.document_number??document.id,
    kind:document.kind,outstandingCents
   }
  }).filter(document=>document.outstandingCents>0)
  const outputStatements=statements.map(statement=>{
   const raw=statement.amount_cents
   if((typeof raw!=='number'&&typeof raw!=='string')||!/^[1-9][0-9]{0,10}$/.test(String(raw))
    ||!Number.isSafeInteger(Number(raw))||Number(raw)>99_999_999_999
    ||typeof statement.id!=='string'||!uuid.test(statement.id)
    ||!['credit','debit'].includes(statement.direction)||statement.currency!=='EUR'
    ||typeof statement.transaction_id!=='string'||typeof statement.booked_on!=='string')
    throw Error('Invalid bank record')
   return {...statement,amount_cents:Number(raw)}
  })
  return response({statements:outputStatements,invoices:outputDocuments,
   canApprove:!permission.error&&permission.data===true})
 }catch{return response({error:'invalid_bank_reconciliation_data'},503)}
}
/** Store claimed bank transactions; never mark an invoice paid without a separate Admin decision. */
export async function POST(request:Request){
 if(!sameOrigin(request))return response({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return response({error:'access_denied'},access.status)
 const form=await multipart(request,1_100_000)
 const file=form?.get('file')
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size===0)
  return response({error:'invalid_file_or_size'},422)
 if(file.size>1_000_000)return response({error:'file_too_large'},413)
 const parsed=validateBankStatementCsv(await file.text())
 if(parsed.errors.length)return response({error:'invalid_bank_rows',errors:parsed.errors.slice(0,20)},422)
 const {data,error}=await client(access.db).rpc('upt_admin_import_bank_statement_transactions',{p_rows:parsed.rows})
 if(error)return response({error:error.code==='23505'?'conflicting_transaction':
    error.code==='42501'?'access_denied':'import_rejected'},error.code==='23505'?409:error.code==='42501'?403:422)
 if(!data||!Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)
   ||data.inserted+data.skipped!==parsed.rows.length)
  return response({error:'unexpected_import_result'},503)
 return response({result:data,preview:{creditCents:parsed.creditCents,debitCents:parsed.debitCents}})
}
/** Final accounting entries require an explicit Admin click and SQL-enforced permission. */
export async function PATCH(request:Request){
 if(!sameOrigin(request))return response({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return response({error:'access_denied'},access.status)
 const {data:canApprove,error:roleError}=await access.db.rpc('upt_is_admin')
 if(roleError)return response({error:'approval_permission_unavailable'},503)
 if(canApprove!==true)return response({error:'admin_required'},403)
 let body:unknown
 try{body=await jsonRequest(request)}catch{return response({error:'invalid_request'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'invalid_request'},422)
 const {action,statementId,documentId,reason}=body as Record<string,unknown>
 if(typeof statementId!=='string'||!uuid.test(statementId))return response({error:'invalid_statement'},422)
 let result
 if(action==='post'&&typeof documentId==='string'&&uuid.test(documentId)){
  result=await client(access.db).rpc('upt_admin_post_bank_statement_payment',{
   p_statement:statementId,p_document:documentId
  })
 }else if(action==='ignore'&&typeof reason==='string'&&reason.trim().length>=5&&reason.trim().length<=500){
  result=await client(access.db).rpc('upt_admin_ignore_bank_statement',{
   p_statement:statementId,p_reason:reason.trim()
  })
 }else return response({error:'invalid_action'},422)
 if(result.error)return response({error:result.error.code==='23505'?'already_resolved':
    result.error.code==='42501'?'admin_required':'match_rejected'},
  result.error.code==='23505'?409:result.error.code==='42501'?403:422)
 return response({result:result.data})
}
