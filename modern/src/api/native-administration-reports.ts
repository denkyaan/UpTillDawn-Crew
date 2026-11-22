// Read-only Administration provider snapshots; exact legacy Main DTOs.
// The original signed Supabase session and permission RPC are verified once
// per request, before any RLS-protected table is queried.
import type {SupabaseClient} from "@supabase/supabase-js"
import {reportProviderTransactions} from "../../../lib/administration/provider-transaction-report.ts"
import {salesReconciliationCsv,salesReconciliationExceptionsCsv} from "../../../lib/administration/sales-reconciliation-report.ts"

export type AdminReportKind="provider-mappings"|"provider-transactions"
const reply=(payload:unknown,status=200)=>Response.json(payload,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})
const csv=(value:string,filename:string)=>new Response(value,{status:200,headers:{
 "Content-Type":"text/csv; charset=utf-8",
 "Content-Disposition":'attachment; filename="'+filename+'"',
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
}})

/** No service role, provider credential, mutation, Next Worker or result cache. */
export async function administrationReportResponse(
 db:SupabaseClient,kind:AdminReportKind,requestUrl:string
):Promise<Response>{
 const {data:allowed,error:permissionError}=await db.rpc("upt_can_manage_administration")
 if(permissionError)return reply({error:"access_denied"},503)
 if(allowed!==true)return reply({error:"access_denied"},403)
 try{
  if(kind==="provider-mappings"){
   const {data,error}=await db.from("admin_provider_event_mappings")
    .select("id,provider,external_event_id,event_id,enabled,created_at")
    .order("created_at",{ascending:false}).limit(200)
   return error?reply({error:"mapping_read_failed"},503):
    reply({mappings:data??[],canActivate:true})
  }
  const format=new URL(requestUrl).searchParams.get("export")
  if(format!==null&&format!=="net"&&format!=="exceptions")
   return reply({error:"invalid_export"},400)
  const {data,error,count}=await db.from("admin_provider_transactions")
   .select("id,event_id,provider,transaction_id,category,sale_reference,status,amount_cents,currency,occurred_at",{count:"exact"})
   .order("occurred_at",{ascending:false}).order("id",{ascending:false}).range(0,5000)
  if(error||!data||count===null||count>5000||data.length!==count)
   return reply({error:"reconciliation_unavailable_or_too_large"},503)
  let report:ReturnType<typeof reportProviderTransactions>
  try{report=reportProviderTransactions(data)}
  catch{return reply({error:"invalid_reconciliation_data"},503)}
  if(!format)return reply({report,transactionCount:data.length})
  return format==="net"
   ?csv(salesReconciliationCsv(report),"provider-sales-reconciliation.csv")
   :csv(salesReconciliationExceptionsCsv(report),"provider-sales-exceptions.csv")
 }catch{return reply({error:kind==="provider-mappings"?"mapping_read_failed":"reconciliation_unavailable_or_too_large"},503)}
}
