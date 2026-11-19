import {supabase} from "./supabase"

// Data API requests carry the signed user's JWT. Supabase RLS determines row
// access, including the administrative and time-based operational windows.
// Avoid all-purpose select('*'), globally cached PII and unbounded data sets.
export type Shift={id:string;event_id:string;workplace_id:string|null;role_name:string|null;scheduled_start:string;scheduled_end:string;status:string;response_status:string|null;shift_kind:string|null;confirmed_at:string|null}
export type CheckIn={id:string;event_id:string;workplace_id:string|null;type:string|null;status:string;requested_at:string|null;decided_at:string|null}
export type WorkSession={id:string;event_id:string;shift_id:string|null;started_at:string|null;ended_at:string|null;status:string}
export type Workplace={id:string;event_id:string;name:string;description:string|null;minimum_staff:number|null;target_staff:number|null;is_active:boolean}
export type InventoryItem={id:string;event_id:string|null;workplace_id:string|null;name:string;category:string|null;available_quantity:number;total_quantity:number;missing_quantity:number;damaged_quantity:number;is_active:boolean}
export type Incident={id:string;event_id:string;workplace_id:string|null;reporter_id:string|null;description:string|null;message:string|null;status:string;created_at:string;urgency:string|null}
export type Briefing={id:string;event_id:string;workplace_id:string|null;title:string;body:string;version:number;required:boolean;updated_at:string}
export type Acknowledgement={briefing_id:string;version:number;acknowledged_at:string}
export type Notification={id:string;title:string;body:string;kind:string;read_at:string|null;created_at:string;link:string|null}
export type FinancialDocument={id:string;kind:string;document_number:string|null;issue_date:string|null;due_date:string|null;currency:string;gross_amount:number;status:string;peppol_status:string|null;event_id:string|null}
export type FinancialPayment={id:string;document_id:string;amount:number;paid_on:string;created_at:string}
export type Profile={id:string;full_name:string|null;phone_number:string|null;home_address:string|null;date_of_birth:string|null;profile_photo_url:string|null;app_profile_completed_at:string|null}
export type ResponsibleAssignment={id:string;event_id:string;workplace_id:string;user_id:string}
export type PromotionTask={id:string;task_id:string;event_id:string|null;title:string;description:string|null;status:string;confirmed_at:string|null}

function failed(error:unknown,code:string):void{if(error)throw new Error(code)}
export async function ownShifts(uid:string,signal:AbortSignal):Promise<Shift[]>{
 const {data,error}=await supabase().from("shifts").select("id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status,response_status,shift_kind,confirmed_at")
  .eq("user_id",uid).neq("status","cancelled").order("scheduled_start",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"shifts_unavailable")
 return (data||[]) as Shift[]
}
export async function ownCheckIns(uid:string,signal:AbortSignal):Promise<CheckIn[]>{
 const {data,error}=await supabase().from("check_ins").select("id,event_id,workplace_id,type,status,requested_at,decided_at")
  .eq("user_id",uid).order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"checkins_unavailable")
 return (data||[]) as CheckIn[]
}
export async function ownHours(uid:string,signal:AbortSignal):Promise<WorkSession[]>{
 const {data,error}=await supabase().from("work_sessions").select("id,event_id,shift_id,started_at,ended_at,status")
  .eq("user_id",uid).order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"hours_unavailable")
 return (data||[]) as WorkSession[]
}
export async function ownProfile(uid:string,signal:AbortSignal):Promise<Profile|null>{
 const {data,error}=await supabase().from("profiles").select("id,full_name,phone_number,home_address,date_of_birth,profile_photo_url,app_profile_completed_at")
  .eq("id",uid).abortSignal(signal).maybeSingle()
 failed(error,"profile_unavailable")
 return data as Profile|null
}
export async function ownNotifications(uid:string,signal:AbortSignal):Promise<Notification[]>{
 const {data,error}=await supabase().from("crew_notifications").select("id,title,body,kind,read_at,created_at,link")
  .eq("user_id",uid).neq("kind","error_report").order("created_at",{ascending:false}).limit(70).abortSignal(signal)
 failed(error,"notifications_unavailable")
 return (data||[]) as Notification[]
}
export async function allowedWorkplaces(signal:AbortSignal):Promise<Workplace[]>{
 const {data,error}=await supabase().from("workplaces").select("id,event_id,name,description,minimum_staff,target_staff,is_active")
  .eq("is_active",true).order("sort_order").limit(100).abortSignal(signal)
 failed(error,"workplaces_unavailable")
 return (data||[]) as Workplace[]
}
export async function allowedInventory(signal:AbortSignal):Promise<InventoryItem[]>{
 const {data,error}=await supabase().from("inventory_items").select("id,event_id,workplace_id,name,category,available_quantity,total_quantity,missing_quantity,damaged_quantity,is_active")
  .eq("is_active",true).order("name").limit(100).abortSignal(signal)
 failed(error,"inventory_unavailable")
 return (data||[]) as InventoryItem[]
}
export async function ownIncidents(uid:string,signal:AbortSignal):Promise<Incident[]>{
 const {data,error}=await supabase().from("incidents").select("id,event_id,workplace_id,reporter_id,description,message,status,created_at,urgency")
  .eq("reporter_id",uid).order("created_at",{ascending:false}).limit(60).abortSignal(signal)
 failed(error,"incidents_unavailable")
 return (data||[]) as Incident[]
}
export async function allowedBriefings(signal:AbortSignal):Promise<Briefing[]>{
 const {data,error}=await supabase().from("briefings").select("id,event_id,workplace_id,title,body,version,required,updated_at")
  .order("updated_at",{ascending:false}).limit(80).abortSignal(signal)
 failed(error,"briefings_unavailable")
 return (data||[]) as Briefing[]
}
export async function ownAcknowledgements(uid:string,signal:AbortSignal):Promise<Acknowledgement[]>{
 const {data,error}=await supabase().from("briefing_acknowledgements").select("briefing_id,version,acknowledged_at")
  .eq("user_id",uid).limit(100).abortSignal(signal)
 failed(error,"briefing_state_unavailable")
 return (data||[]) as Acknowledgement[]
}
export async function responsibleAssignments(uid:string,signal:AbortSignal):Promise<ResponsibleAssignment[]>{
 const {data,error}=await supabase().from("responsible_assignments").select("id,event_id,workplace_id,user_id")
  .eq("user_id",uid).limit(90).abortSignal(signal)
 failed(error,"responsible_assignments_unavailable")
 return (data||[]) as ResponsibleAssignment[]
}
export async function responsibleShifts(eventId:string,signal:AbortSignal):Promise<Shift[]>{
 // Event ID is selected from the verified responsibility assignments; RLS
 // independently enforces responsible/admin scope.
 const {data,error}=await supabase().from("shifts").select("id,event_id,workplace_id,role_name,scheduled_start,scheduled_end,status,response_status,shift_kind,confirmed_at")
  .eq("event_id",eventId).order("scheduled_start").limit(100).abortSignal(signal)
 failed(error,"responsible_shifts_unavailable")
 return (data||[]) as Shift[]
}
export async function administrationDocuments(signal:AbortSignal):Promise<FinancialDocument[]>{
 const {data,error}=await supabase().from("admin_financial_documents").select("id,kind,document_number,issue_date,due_date,currency,gross_amount,status,peppol_status,event_id")
  .order("created_at",{ascending:false}).limit(100).abortSignal(signal)
 failed(error,"financial_documents_unavailable")
 return (data||[]) as FinancialDocument[]
}
export async function administrationPayments(signal:AbortSignal):Promise<FinancialPayment[]>{
 const {data,error}=await supabase().from("admin_financial_payments").select("id,document_id,amount,paid_on,created_at")
  .order("created_at",{ascending:false}).limit(100).abortSignal(signal)
 failed(error,"financial_payments_unavailable")
 return (data||[]) as FinancialPayment[]
}
export async function promotionTasks(uid:string,signal:AbortSignal):Promise<PromotionTask[]>{
 // Current user's assignment IDs are the only task actions exposed in this
 // portal. Never enumerate every promotion task or expose other users' work.
 const {data,error}=await supabase().from("task_assignments")
  .select("id,status,confirmed_at,tasks!inner(id,event_id,title,description,promotion_only)")
  .eq("user_id",uid).eq("tasks.promotion_only",true).order("created_at",{ascending:false})
  .limit(80).abortSignal(signal)
 failed(error,"promotion_assignments_unavailable")
 const rows=(data||[]) as unknown as {
  id:string;status:string;confirmed_at:string|null;
  tasks:{id:string;event_id:string|null;title:string;description:string|null}|null
 }[]
 if(rows.some(row=>!row.tasks))throw new Error("promotion_assignments_incomplete")
 return rows.map(row=>({
  id:row.id,task_id:row.tasks!.id,
  event_id:row.tasks!.event_id,title:row.tasks!.title,
  description:row.tasks!.description,status:row.status,
  confirmed_at:row.confirmed_at,
 }))
}
