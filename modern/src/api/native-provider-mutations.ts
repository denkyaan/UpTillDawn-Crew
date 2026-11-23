// Native provider mappings POST/PATCH and provider CSV transactions POST.
// Original source semantics and row-locking SQL RPC preserved; signed RLS
// and upt_can_manage_administration are verified by Worker first.
import type {SupabaseClient} from "@supabase/supabase-js"
import {validateProviderEventMappings} from "../../../lib/administration/provider-event-mapping.ts"
import {validateProviderTransactionCsv} from "../../../lib/administration/provider-transaction-import.ts"
import {readStrictJson} from "../../../lib/strict-json-body.ts"
import {readBoundedFormData} from "../../../lib/bounded-form-data.ts"
import {sameOriginMutation} from "./native-admin-document-routes.ts"
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
export async function nativeProviderMappingCreate(db:SupabaseClient,actorId:string,request:Request){
 if(!sameOriginMutation(request))return respond({error:"forbidden"},403)
 let body:unknown
 try{body=await readStrictJson(request,8192)}catch(e){return respond({error:e instanceof Error&&e.message==="too_large"?"payload_too_large":"invalid_json"},e instanceof Error&&e.message==="too_large"?413:400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return respond({error:"invalid_mapping"},422)
 const input=body as Record<string,unknown>
 const check=validateProviderEventMappings([{provider:input.provider as "eventix"|"sumup"|"eventpay",externalEventId:input.externalEventId as string,eventId:input.eventId as string,enabled:false}])
 if(check.errors.length)return respond({error:"invalid_mapping",details:check.errors},422)
 const m=check.mappings[0]
 const {data:event,error:eventError}=await db.from("events").select("id").eq("id",m.eventId).maybeSingle()
 if(eventError)return respond({error:"event_lookup_failed"},503)
 if(!event)return respond({error:"event_not_found"},422)
 const {data,error}=await db.from("admin_provider_event_mappings").insert({provider:m.provider,external_event_id:m.externalEventId,event_id:m.eventId,enabled:false,created_by:actorId}).select("id,provider,external_event_id,event_id,enabled").single()
 if(error)return respond({error:error.code==="23505"?"duplicate_mapping":"mapping_write_failed"},error.code==="23505"?409:503)
 return respond({mapping:data},201)
}

export async function nativeProviderMappingUpdate(db:SupabaseClient,id:string,request:Request){
 if(!sameOriginMutation(request))return reply({error:"forbidden"},403)
 if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return reply({error:"invalid_id"},422)
 let body:unknown
 try{body=await readStrictJson(request,4096)}catch(e){return reply({error:e instanceof Error&&e.message==="too_large"?"payload_too_large":"invalid_json"},e instanceof Error&&e.message==="too_large"?413:400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"invalid_payload"},422)
 const input=body as Record<string,unknown>
 if(Object.keys(input).length!==1||typeof input.enabled!=="boolean")return reply({error:"invalid_payload"},422)
 const {data,error}=await db.from("admin_provider_event_mappings").update({enabled:input.enabled}).eq("id",id).select("id,enabled").maybeSingle()
 if(error)return reply({error:"mapping_update_failed"},503)
 return data?reply({mapping:data}):reply({error:"not_found"},404)
}

export async function nativeProviderTransactionsImport(db:SupabaseClient,request:Request){
 if(!sameOriginMutation(request))return reply({error:'forbidden'},403)
 let form:FormData
 try{form=await readBoundedFormData(request,1_100_000)}
 catch(e){return reply({error:e instanceof Error&&e.message==="too_large"?"file_too_large":"invalid_file"},
  e instanceof Error&&e.message==="too_large"?413:400)}
 const file=form.get('file'),mappingId=String(form.get('mappingId')??'')
 if(!uuid.test(mappingId)||!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv')||file.size===0)
  return reply({error:'invalid_import'},422)
 if(file.size>1_000_000)return reply({error:'file_too_large'},413)
 const {data:mapping,error:mappingError}=await db.from('admin_provider_event_mappings')
  .select('id,event_id,external_event_id,provider,enabled').eq('id',mappingId).eq('enabled',true).maybeSingle()
 if(mappingError)return reply({error:'mapping_unavailable'},503)
 if(!mapping||!['eventix','sumup','eventpay'].includes(mapping.provider))return reply({error:'mapping_inactive'},409)
 const parsed=validateProviderTransactionCsv(await file.text(),mapping.event_id,mapping.external_event_id,500,mapping.provider as 'eventix'|'sumup'|'eventpay')
 if(parsed.errors.length)return reply({error:'invalid_rows',errors:parsed.errors.slice(0,20)},422)
 // SQL derives event/provider from the locked mapping, even if a caller bypasses this API.
 const {data,error}=await db.rpc('upt_import_admin_provider_transactions',{
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

