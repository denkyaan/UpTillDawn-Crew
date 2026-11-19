import {supabase} from "./supabase"

export type Timesheet={
 id:string;event_id:string;user_id:string;status:string;
 submitted_at:string|null;reviewed_at:string|null;
 rejection_reason:string|null;locked_at:string|null;created_at:string
}
const columns="id,event_id,user_id,status,submitted_at,reviewed_at,rejection_reason,locked_at,created_at"
export async function loadOwnTimesheets(uid:string,signal:AbortSignal):Promise<Timesheet[]>{
 const {data,error}=await supabase().from("timesheets").select(columns)
  .eq("user_id",uid).order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 if(error)throw new Error("timesheet_read_denied")
 return (data||[]) as Timesheet[]
}
export async function loadReviewerTimesheets(signal:AbortSignal):Promise<Timesheet[]>{
 // Server RLS + upt_review_timesheet RPC independently check reviewer scope,
 // team assignment, timesheet state and prohibit approving your own hours.
 const {data,error}=await supabase().from("timesheets").select(columns)
  .order("created_at",{ascending:false}).limit(80).abortSignal(signal)
 if(error)throw new Error("timesheet_review_read_denied")
 return (data||[]) as Timesheet[]
}
