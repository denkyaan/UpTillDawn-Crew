import {verifyOwnSession,requireUuid,MIGRATION_WRITES_ENABLED} from "./operational-writes"
import {supabase} from "./supabase"
import {normalizeShiftDeclineReason} from "../shared/shift-response"

// Migration feature gate remains OFF. Supabase existing SECURITY DEFINER RPCs
// independently enforce live actor, assignments, shift windows and approvals.
export async function acknowledgeOwnBriefing(id:string):Promise<void>{
 requireUuid(id);await verifyOwnSession()
 const {error}=await supabase().rpc("upt_acknowledge_briefing",{p_briefing:id})
 if(error)throw new Error("briefing_rejected")
}
export async function confirmOwnShift(id:string):Promise<void>{
 requireUuid(id);await verifyOwnSession()
 const {error}=await supabase().rpc("upt_confirm_shift",{p_shift:id})
 if(error)throw new Error("shift_confirmation_rejected")
}
// The existing function enforces auth.uid() = assigned shift user, start
// window, active-hours rules and an immutable audit event. No client UPDATE.
export async function declineOwnShift(id:string,reason:string):Promise<void>{
 requireUuid(id)
 const clean=normalizeShiftDeclineReason(reason)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_respond_shift",{
  p_shift:id,p_response:"declined",p_reason:clean
 })
 if(error)throw new Error("shift_decline_rejected")
}
export async function acknowledgeAllowedIncident(id:string):Promise<void>{
 requireUuid(id);await verifyOwnSession()
 const {error}=await supabase().rpc("upt_acknowledge_incident",{p_incident:id})
 if(error)throw new Error("incident_acknowledgement_rejected")
}
// Existing audited RPC checks auth.uid() against each notification. Only
// confirmed user interaction may submit this mutation; no direct UPDATE.
export async function markOwnNotificationRead(id:string):Promise<void>{
 requireUuid(id)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_mark_notification_read",{p_notification:id})
 if(error)throw new Error("notification_read_rejected")
}
// Processes exactly the displayed bounded set, not unseen pages. Three
// requests at once cap backend fan-out and avoid a Worker proxy.
export async function markDisplayedNotificationsRead(ids:readonly string[]):Promise<void>{
 if(ids.length>70)throw new Error("notification_batch_too_large")
 const unique=[...new Set(ids.map(requireUuid))]
 if(unique.length===0)return
 await verifyOwnSession()
 for(let i=0;i<unique.length;i+=3){
  const results=await Promise.all(unique.slice(i,i+3).map(id=>
   supabase().rpc("upt_mark_notification_read",{p_notification:id})
  ))
  if(results.some(result=>result.error))throw new Error("notification_batch_partial")
 }
}
export function writesAvailable(){return MIGRATION_WRITES_ENABLED}
