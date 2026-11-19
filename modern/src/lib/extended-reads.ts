import {supabase} from "./supabase"

// Read-only projections of existing tables: the actor's JWT and the current
// PostgreSQL RLS policies enforce visibility. No service-role Worker proxy.
// Every query is bounded, cancellable and emits only fields needed in UI.
export type HistoryRow={id:string;title:string;subtitle:string;status:string;when:string|null}
const rows=(data:unknown):Record<string,unknown>[]=>Array.isArray(data)?data as Record<string,unknown>[]:[]
const str=(value:unknown)=>typeof value==="string"?value:value===null||value===undefined?"—":String(value)
const when=(value:unknown)=>typeof value==="string"?value:null
const projected=(data:unknown,map:(v:Record<string,unknown>)=>HistoryRow)=>rows(data).map(map)
const failed=(error:unknown,code:string)=>{if(error)throw new Error(code)}

export async function ownTimesheets(uid:string,signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("timesheets")
 .select("id,event_id,status,submitted_at,reviewed_at,locked_at")
 .eq("user_id",uid).order("updated_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"timesheets_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Timesheet "+str(v.event_id).slice(0,8),subtitle:"Ingediend: "+str(v.submitted_at)+" · Review: "+str(v.reviewed_at),status:str(v.status),when:when(v.locked_at||v.submitted_at)}))
}
export async function ownTimeReviews(uid:string,signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("time_review_requests")
 .select("id,status,requested_start,scheduled_start,created_at")
 .eq("user_id",uid).order("created_at",{ascending:false}).limit(70).abortSignal(signal)
 failed(error,"time_reviews_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Uurcontrole",subtitle:"Gepland: "+str(v.scheduled_start)+" · Gevraagd: "+str(v.requested_start),status:str(v.status),when:when(v.created_at)}))
}
export async function allowedSales(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("sales_transactions")
 .select("id,product_name,transaction_type,quantity,total_cents,payment_method,created_at")
 .order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"sales_unavailable")
 return projected(data,v=>({id:str(v.id),title:str(v.product_name),subtitle:str(v.quantity)+" st. · "+str(v.total_cents)+" cent · "+str(v.payment_method),status:str(v.transaction_type),when:when(v.created_at)}))
}
export async function allowedInventoryIssues(uid:string,signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("inventory_issues")
 .select("id,item_id,quantity,outstanding_quantity,issued_at,closed_at")
 .eq("user_id",uid).order("issued_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"inventory_issues_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Uitgifte "+str(v.item_id).slice(0,8),subtitle:"Aantal: "+str(v.quantity)+" · Nog uitstaand: "+str(v.outstanding_quantity),status:v.closed_at?"Afgesloten":"Open",when:when(v.issued_at)}))
}
export async function allowedSettlements(uid:string,signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("inventory_settlement_requests")
 .select("id,issue_id,condition,quantity,status,created_at")
 .eq("user_id",uid).order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"settlements_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Teruggave "+str(v.issue_id).slice(0,8),subtitle:"Aantal: "+str(v.quantity)+" · Staat: "+str(v.condition),status:str(v.status),when:when(v.created_at)}))
}
export async function allowedMovements(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("inventory_movements")
 .select("id,item_id,movement_type,quantity,created_at")
 .order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"movements_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Voorraadbeweging "+str(v.item_id).slice(0,8),subtitle:"Aantal: "+str(v.quantity),status:str(v.movement_type),when:when(v.created_at)}))
}
export async function adminTicketImports(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("admin_ticket_imports")
 .select("id,source,quantity,inserted_rows,skipped_rows,created_at")
 .order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"ticket_imports_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Ticketimport "+str(v.source),subtitle:"Tickets: "+str(v.quantity)+" · Nieuw: "+str(v.inserted_rows)+" · Overgeslagen: "+str(v.skipped_rows),status:"Import geregistreerd",when:when(v.created_at)}))
}
export async function adminTicketSales(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("admin_ticket_sales")
 .select("id,source,quantity,gross_cents,currency,sold_at")
 .order("sold_at",{ascending:false}).limit(100).abortSignal(signal)
 failed(error,"ticket_sales_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Ticketverkoop "+str(v.source),subtitle:"Aantal: "+str(v.quantity)+" · Bruto: "+str(v.gross_cents)+" cent ("+str(v.currency)+")",status:"Geregistreerd",when:when(v.sold_at)}))
}
export async function adminContractSignatures(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("administration_contract_signing_requests")
 .select("id,document_type,document_version,status,created_at,completed_at")
 .order("created_at",{ascending:false}).limit(70).abortSignal(signal)
 failed(error,"signing_requests_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Contract "+str(v.document_type),subtitle:"Versie "+str(v.document_version)+" · Voltooid: "+str(v.completed_at),status:str(v.status),when:when(v.created_at)}))
}
export async function adminTimesheets(signal:AbortSignal):Promise<HistoryRow[]>{
 const {data,error}=await supabase().from("timesheets")
 .select("id,event_id,status,submitted_at,reviewed_at,locked_at")
 .order("updated_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"admin_timesheets_unavailable")
 return projected(data,v=>({id:str(v.id),title:"Timesheet "+str(v.event_id).slice(0,8),subtitle:"Ingediend: "+str(v.submitted_at)+" · Laatste review: "+str(v.reviewed_at),status:str(v.status),when:when(v.submitted_at)}))
}
