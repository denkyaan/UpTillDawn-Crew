import {supabase} from "./supabase"

export type EventRow={id:string;name:string;venue:string|null;address:string|null;start_at:string;end_at:string;status:string;registration_deadline:string|null;max_joiners:number|null}
export type TaskRow={id:string;status:string;confirmed_at:string|null;tasks:{id:string;title:string;description:string|null;event_id:string|null}|null}
export type ChatRow={id:string;name:string;kind:string}
const DEADLINE_MS=12000

// The browser sends the signed user's token DIRECTLY to Supabase PostgREST.
// Avoid duplicate read proxies on the Worker; the existing RLS policies apply.
// Each call has a bounded result count and is cancelled when changing routes.
export async function loadEvents(signal:AbortSignal):Promise<EventRow[]>{
 const s=supabase()
 const {data,error}=await s.from("events")
  .select("id,name,venue,address,start_at,end_at,status,registration_deadline,max_joiners")
  .gte("end_at",new Date().toISOString())
  .neq("status","archived").order("start_at",{ascending:true})
  .limit(80).abortSignal(signal)
 if(error)throw new Error("events_unavailable")
 return (data||[]) as EventRow[]
}
export async function loadTasks(uid:string,signal:AbortSignal):Promise<TaskRow[]>{
 const {data,error}=await supabase().from("task_assignments")
  .select("id,status,confirmed_at,tasks(id,title,description,event_id)")
  .eq("user_id",uid).order("created_at",{ascending:false})
  .limit(100).abortSignal(signal)
 if(error)throw new Error("tasks_unavailable")
 return (data||[]) as unknown as TaskRow[]
}
export async function loadChatList(signal:AbortSignal):Promise<ChatRow[]>{
 const {data,error}=await supabase().from("chat_channels")
  .select("id,name,kind").order("name")
  .limit(60).abortSignal(signal)
 if(error)throw new Error("chat_unavailable")
 return (data||[]) as ChatRow[]
}
export type FinanceSummary={documents:string;drafts:string;outstanding_cents:string;paid_cents:string}
export async function loadFinanceSummary(signal:AbortSignal):Promise<FinanceSummary>{
 const {data,error}=await supabase().rpc("upt_administration_finance_summary").abortSignal(signal)
 if(error||!data||typeof data!=="object")throw new Error("finance_unavailable")
 const record=data as unknown as Record<string,unknown>
 for(const key of ["documents","drafts","outstanding_cents","paid_cents"])
  if(typeof record[key]!=="string"||!/^\d+$/.test(record[key] as string))throw new Error("finance_invalid")
 return record as FinanceSummary
}
export function requestDeadline():{signal:AbortSignal;cancel:()=>void}{
 const controller=new AbortController()
 const handle=setTimeout(()=>controller.abort(),DEADLINE_MS)
 return {signal:controller.signal,cancel:()=>{clearTimeout(handle);controller.abort()}}
}
