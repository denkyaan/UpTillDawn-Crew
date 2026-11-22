// Native read-only replacements for the two original Administration CSV routes.
// Reuse the exact original CSV and validation functions, not approximations.
// Every request checks the original signed user's administration RPC grant.
import {financeCsv} from "../../../lib/administration/finance-report.ts"
import {financeSummaryKeys,validateFinanceSummary} from "../../../lib/administration/finance-summary.ts"
import {validateTicketSalesSummary,ticketSalesByEvent} from "../../../lib/administration/ticket-sales-summary.ts"

export type AdminExportDb={
 rpc:(name:string)=>Promise<{data:unknown;error:unknown}>
}

export type AdminExportKind="finance"|"tickets"
const headers={
 "Content-Type":"text/csv; charset=utf-8",
 "Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"
}
const reject=(code:string,status:401|403|503)=>Response.json({error:code},{status,headers:{"Cache-Control":"no-store"}})

/** This uses the SAME upt_can_manage_administration RPC as original Main's
 * administrationAccess(), never browser-supplied roles or service keys.
 * RLS still scopes the subsequent read to the signed caller. */
export async function administrationCsvResponse(db:AdminExportDb,kind:AdminExportKind):Promise<Response>{
 try{
  const {data:canManage,error:permissionError}=await db.rpc("upt_can_manage_administration")
  if(permissionError)return reject("forbidden",503)
  if(canManage!==true)return reject("forbidden",403)

  if(kind==="finance"){
   const {data,error}=await db.rpc("upt_administration_finance_summary")
   if(error)return reject("report_unavailable",503)
   if(!validateFinanceSummary(data))return reject("invalid_report_data",503)
   const csv=financeCsv([["status","invoice_count"],...financeSummaryKeys.map(key=>[key,data[key]])])
   return new Response(csv,{status:200,headers:{
    ...headers,"Content-Disposition":'attachment; filename="invoice-reconciliation-summary.csv"'
   }})
  }

  const {data,error}=await db.rpc("upt_ticket_sales_summary")
  if(error||!Array.isArray(data))return reject("report_unavailable",503)
  if(!validateTicketSalesSummary(data))return reject("invalid_report_data",503)
  const events=ticketSalesByEvent(data)
  const csv=financeCsv([["event_id","source_count","sale_rows","quantity","gross_cents"],
   ...events.map(event=>[event.eventId,String(event.sourceCount),String(event.saleRows),
    String(event.quantity),String(event.grossCents)])])
  return new Response(csv,{status:200,headers:{
   ...headers,"Content-Disposition":'attachment; filename="ticket-event-summary.csv"'
  }})
 }catch{return reject("report_unavailable",503)}
}
