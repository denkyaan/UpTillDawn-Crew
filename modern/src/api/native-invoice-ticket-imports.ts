// Original CSV imports extracted from Next.js: bounded uploads, content
// validation, exact SHA-256 and all-or-nothing RLS-enforced SQL RPCs.
// Caller must first verify signed session, admin permission and QA write gate.
import {createHash} from "node:crypto"
import type {SupabaseClient} from "@supabase/supabase-js"
import {readBoundedFormData} from "../../../lib/bounded-form-data.ts"
import {validateTicketSalesCsv} from "../../../lib/administration/ticket-import.ts"
import {validateInvoiceLinesCsv} from "../../../lib/administration/invoice-line-csv.ts"
import {safeUploadName} from "../../../lib/upload-security.ts"
import {sameOriginMutation} from "./native-admin-document-routes.ts"
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})
const fail=(error:string,status:number)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}})
export async function nativeInvoiceLinesImport(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return reply({error:'forbidden'},403)
 const form=await readBoundedFormData(request,115_000).catch(()=>null)
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

export async function nativeTicketCsvImport(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return fail("forbidden",403)
 // Read a bounded stream before parsing multipart data; Content-Length is untrusted.

 if(!reader)return fail("invalid_file",400)
 let form:FormData
 try{form=await readBoundedFormData(request,2_100_000)}
 catch(error){return fail(error instanceof Error&&error.message==="too_large"?"file_too_large":"invalid_file",error instanceof Error&&error.message==="too_large"?413:400)}
 const file=form.get("file"),eventId=String(form.get("eventId")??""),source=String(form.get("source")??"").trim()
 const mappedAttempt=form.has("mappingId")||form.has("externalEventId")
 const mappingId=String(form.get("mappingId")??""),externalEventId=String(form.get("externalEventId")??"")
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".csv")||file.size===0)return fail("invalid_file",422)
 if(file.size>2_000_000)return fail("file_too_large",413)
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId)||!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(source))return fail("invalid_target",422)
 // Mapped provider imports are bound to an enabled, immutable mapping, not
 // a client-provided claim about which internal event a provider row belongs to.
 if(mappedAttempt){
  if(!["eventix","sumup"].includes(source)||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(mappingId)||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(externalEventId))
   return fail("invalid_mapping",422)
  const {data:mapping,error:mappingError}=await db.from("admin_provider_event_mappings")
   .select("id").eq("id",mappingId).eq("provider",source)
   .eq("external_event_id",externalEventId).eq("event_id",eventId)
   .eq("enabled",true).maybeSingle()
  if(mappingError)return fail("mapping_unavailable",503)
  if(!mapping)return fail("mapping_inactive_or_mismatch",409)
 }
 const csv=await file.text()
 const validation=validateTicketSalesCsv(csv,eventId,10000,mappedAttempt?externalEventId:undefined)
 if(validation.errors.length)return Response.json({error:"invalid_rows",errors:validation.errors.slice(0,20)},{status:422})
 const sha=createHash("sha256").update(csv).digest("hex")
 const {data,error}=await db.rpc("upt_import_ticket_sales",{
  p_event:eventId,p_source:source,p_sha256:sha,p_rows:validation.rows,
 })
 if(error){
  const code=error.code==="42501"?403:error.code==="23505"?409:422
  return fail(code===409?"conflicting_sale":"import_rejected",code)
 }
 return Response.json({result:data},{headers:{"Cache-Control":"private, no-store"}})
}

