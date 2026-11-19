import {supabase} from "./supabase"
import {requireUuid,verifyOwnSession} from "./operational-writes"
import {validateCheckinDecision} from "../shared/approval-validation"
export type PendingCheckin={id:string;user_id:string;event_id:string;workplace_id:string|null;
 requested_at:string|null;reviewer_kind:string|null;early_reason:string|null;type:string|null}
export async function pendingReviewCheckins(eventId:string|null,signal:AbortSignal):Promise<PendingCheckin[]>{
 let query=supabase().from("check_ins")
  .select("id,user_id,event_id,workplace_id,requested_at,reviewer_kind,early_reason,type")
  .eq("status","pending")
  .order("created_at",{ascending:false}).limit(60)
 if(eventId)query=query.eq("event_id",requireUuid(eventId))
 const {data,error}=await query.abortSignal(signal)
 if(error)throw new Error("pending_checkins_unavailable")
 return (data||[]) as PendingCheckin[]
}
export type PendingCheckout={id:string;user_id:string;event_id:string;workplace_id:string|null;
 requested_at:string|null;reviewer_kind:string|null}
export async function pendingReviewCheckouts(eventId:string|null,signal:AbortSignal):Promise<PendingCheckout[]>{
 let query=supabase().from("check_outs")
  .select("id,user_id,event_id,workplace_id,requested_at,reviewer_kind")
  .eq("status","pending").order("requested_at",{ascending:false}).limit(60)
 if(eventId)query=query.eq("event_id",requireUuid(eventId))
 const {data,error}=await query.abortSignal(signal)
 if(error)throw new Error("pending_checkouts_unavailable")
 return (data||[]) as PendingCheckout[]
}
export async function decideAllowedCheckout(id:string,approve:boolean,notes:string):Promise<void>{
 requireUuid(id)
 const clean=validateCheckinDecision(approve,notes)
 await verifyOwnSession()
 // This audited DB RPC closes active breaks and work time only on approval.
 // Merely requesting a stop does not end the work session.
 const {error}=await supabase().rpc("upt_decide_check_out",{
  p_check_out:id,p_approve:approve,p_notes:clean
 })
 if(error)throw new Error("checkout_decision_rejected")
}
export async function decideAllowedCheckin(id:string,approve:boolean,notes:string):Promise<void>{
 requireUuid(id)
 const clean=validateCheckinDecision(approve,notes)
 await verifyOwnSession()
 // Authoritative server contract rejects own-hour approvals, wrong reviewer,
 // expired shift windows and duplicate decisions; creates work session only on approval.
 const {error}=await supabase().rpc("upt_decide_check_in",{
  p_check_in:id,p_approve:approve,p_notes:clean
 })
 if(error)throw new Error("checkin_decision_rejected")
}
