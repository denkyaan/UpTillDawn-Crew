import {supabase} from "./supabase"
import {requireUuid,verifyOwnSession} from "./operational-writes"
export type OwnBreak={id:string;work_session_id:string;started_at:string;ended_at:string|null}
export type TimeSummary={work_session_id:string;gross_seconds:number;break_seconds:number;
 break_allowance_seconds:number;regular_break_seconds:number;excess_break_seconds:number;
 break_balance_seconds:number;net_payable_seconds:number;active_break:boolean}
export async function ownSessionBreaks(uid:string,sessionId:string,signal:AbortSignal):Promise<OwnBreak[]>{
 requireUuid(uid);requireUuid(sessionId)
 const {data,error}=await supabase().from("break_sessions")
  .select("id,work_session_id,started_at,ended_at")
  .eq("user_id",uid).eq("work_session_id",sessionId)
  .order("started_at",{ascending:false}).limit(30).abortSignal(signal)
 if(error)throw new Error("break_history_unavailable")
 return (data||[]) as OwnBreak[]
}
export async function ownSessionTimeSummary(sessionId:string,signal:AbortSignal):Promise<TimeSummary>{
 requireUuid(sessionId)
 const {data,error}=await supabase().rpc("upt_work_session_time_summary",{
  p_work_session:sessionId
 }).abortSignal(signal)
 if(error||!Array.isArray(data)||data.length!==1||data[0]?.work_session_id!==sessionId)
  throw new Error("time_summary_unavailable")
 const summary=data[0] as Record<string,unknown>
 for(const key of ["gross_seconds","break_seconds","break_allowance_seconds","regular_break_seconds",
  "excess_break_seconds","break_balance_seconds","net_payable_seconds"])
  if(typeof summary[key]!=="number"||!Number.isSafeInteger(summary[key])||(summary[key] as number)<0)
   throw new Error("invalid_time_summary")
 if(typeof summary.active_break!=="boolean")throw new Error("invalid_time_summary")
 return summary as TimeSummary
}
export async function startOwnBreak(sessionId:string):Promise<string>{
 requireUuid(sessionId)
 await verifyOwnSession()
 const {data,error}=await supabase().rpc("upt_start_break",{p_work_session:sessionId})
 if(error||typeof data!=="string")throw new Error("break_start_unconfirmed")
 return requireUuid(data)
}
export async function stopOwnBreak(breakId:string):Promise<void>{
 requireUuid(breakId)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_stop_break",{p_break:breakId})
 if(error)throw new Error("break_stop_unconfirmed")
}
