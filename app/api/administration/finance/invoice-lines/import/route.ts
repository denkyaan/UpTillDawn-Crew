import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {NextResponse} from 'next/server'
import {administrationAccess,sameOrigin} from '@/lib/administration/access'
import {validateInvoiceLinesCsv} from '@/lib/administration/invoice-line-csv'
import {safeUploadName} from '@/lib/upload-security'

export const dynamic='force-dynamic'
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{
 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
}})

async function boundedForm(request:Request,maxBytes=115_000):Promise<FormData|null>{
 const reader=request.body?.getReader()
 if(!reader)return null
 const chunks:Uint8Array[]=[]
 let size=0
 try{
  while(true){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.byteLength
   if(size>maxBytes){await reader.cancel();return null}
   chunks.push(value)
  }
  const bytes=new Uint8Array(size)
  let offset=0
  for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
  return await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData()
 }catch{return null}
}

/** Browser supplies normalized CSV; SQL is responsible for all-or-nothing writes. */
export async function POST(request:Request){
 if(!sameOrigin(request))return reply({error:'forbidden'},403)
 const access=await administrationAccess()
 if(!access.ok)return reply({error:'access_denied'},access.status)
 const form=await boundedForm(request)
 if(!form)return reply({error:'invalid_or_too_large_upload'},413)
 const documentId=form.get('documentId'),requestId=form.get('requestId')
 const file=form.get('file')
 if(typeof documentId!=='string'||typeof requestId!=='string'||
    !uuid.test(documentId)||!uuid.test(requestId)||
    !(file instanceof File)||file.size===0||file.size>100_000||
    !file.name.toLowerCase().endsWith('.csv'))
  return reply({error:'invalid_import_request'},422)
 let csv:string,bytes:Uint8Array
 try{
  bytes=new Uint8Array(await file.arrayBuffer())
  csv=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 }catch{return reply({error:'invalid_file_encoding'},422)}
 const parsed=validateInvoiceLinesCsv(csv)
 if(parsed.errors.length)return reply({error:'invalid_invoice_lines',errors:parsed.errors.slice(0,15)},422)
 const hash=createHash('sha256').update(bytes).digest('hex')
 const name=safeUploadName(file.name).slice(0,200)
 const db=access.db as unknown as SupabaseClient
 const {data,error}=await db.rpc('upt_admin_import_invoice_lines_csv',{
  p_request:requestId,p_document:documentId,p_sha256:hash,
  p_source_name:name,p_rows:parsed.rows
 })
 if(error)return reply({error:error.code==='23505'?'conflicting_import':
   error.code==='42501'?'access_denied':'import_rejected'},
   error.code==='23505'?409:error.code==='42501'?403:422)
 if(!data||!Number.isSafeInteger(data.inserted)||!Number.isSafeInteger(data.skipped)||
   data.inserted+data.skipped!==parsed.rows.length||data.documentId!==documentId)
  return reply({error:'invalid_import_result'},503)
 return reply({inserted:data.inserted,skipped:data.skipped,documentId,
  preview:{netCents:parsed.netCents,taxCents:parsed.taxCents}})
}
