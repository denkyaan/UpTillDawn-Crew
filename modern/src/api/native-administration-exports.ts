// Native read-only replacements for the two original Administration CSV routes.
// Reuse the exact original CSV and validation functions, not approximations.
// Every request checks the original signed user's administration RPC grant.
import {financeCsv} from "../../../lib/administration/finance-report.ts"
import {financeSummaryKeys,validateFinanceSummary} from "../../../lib/administration/finance-summary.ts"
import {validateTicketSalesSummary,ticketSalesByEvent} from "../../../lib/administration/ticket-sales-summary.ts"
import {payrollCsv,type PayrollRow} from "../../../lib/administration/payroll-export.ts"

export type AdminExportDb={
 rpc:(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>
}

export type AdminExportKind="finance"|"tickets"|"ticket-sales"|"payroll"
const headers={
 "Content-Type":"text/csv; charset=utf-8",
 "Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"
}
const reject=(code:string,status:400|401|403|409|413|422|503)=>Response.json({error:code},{status,headers:{"Cache-Control":"no-store"}})
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const download=(text:string,filename:string)=>new Response(text,{status:200,headers:{...headers,"Content-Disposition":'attachment; filename="'+filename+'"'}})

/** This uses the SAME upt_can_manage_administration RPC as original Main's
 * administrationAccess(), never browser-supplied roles or service keys.
 * RLS still scopes the subsequent read to the signed caller. */
export async function administrationCsvResponse(db:AdminExportDb,kind:AdminExportKind,eventId:string|null=null):Promise<Response>{
 try{
  const {data:canManage,error:permissionError}=await db.rpc("upt_can_manage_administration")
  const denied=kind==="payroll"?"access_denied":"forbidden"
  if(permissionError)return reject(denied,503)
  if(canManage!==true)return reject(denied,403)

  if(kind==="finance"){
   const {data,error}=await db.rpc("upt_administration_finance_summary")
   if(error)return reject("report_unavailable",503)
   if(!validateFinanceSummary(data))return reject("invalid_report_data",503)
   const csv=financeCsv([["status","invoice_count"],...financeSummaryKeys.map(key=>[key,data[key]])])
   return download(csv,"invoice-reconciliation-summary.csv")
  }

  if(kind==="payroll"){
   // Original payroll read is a single RLS-scoped transaction. Never export
   // a partial row snapshot or accept a malformed event identifier.
   const event=eventId??""
   if(!uuid.test(event))return reject("event_required",422)
   const {data,error}=await db.rpc("upt_administration_payroll_rows",{p_event:event})
   if(error)return reject("payroll_unavailable",409)
   if(!Array.isArray(data)||data.length>10000)return reject("export_too_large",413)
   if(!data.length)return reject("no_approved_timesheets",422)
   try{return download(payrollCsv(data as PayrollRow[]),"approved-payroll-"+event+".csv")}
   catch{return reject("invalid_payroll_data",409)}
  }

  const {data,error}=await db.rpc("upt_ticket_sales_summary")
  if(error||!Array.isArray(data))return reject("report_unavailable",503)
  if(!validateTicketSalesSummary(data))return reject("invalid_report_data",503)
  if(kind==="ticket-sales"){
   // Original Main validates this filter only after receiving the full
   // signed ticket report. Maintain that exact order and output.
   if(eventId!==null&&!uuid.test(eventId))return reject("invalid_event",400)
   const selected=eventId===null?data:data.filter(row=>row.event_id.toLowerCase()===eventId.toLowerCase())
   return download(financeCsv([["event_id","source","sale_rows","quantity","gross_cents"],
    ...selected.map(row=>[row.event_id,row.source,row.sale_rows,row.quantity,row.gross_cents])]),"ticket-sales.csv")
  }
  const events=ticketSalesByEvent(data)
  const csv=financeCsv([["event_id","source_count","sale_rows","quantity","gross_cents"],
   ...events.map(event=>[event.eventId,String(event.sourceCount),String(event.saleRows),
    String(event.quantity),String(event.grossCents)])])
  return download(csv,"ticket-event-summary.csv")
 }catch{return reject("report_unavailable",503)}
}
