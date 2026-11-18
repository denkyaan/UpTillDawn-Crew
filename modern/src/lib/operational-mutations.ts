import {verifyOwnSession,requireUuid,MIGRATION_WRITES_ENABLED} from "./operational-writes"
import {supabase} from "./supabase"

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
export async function acknowledgeAllowedIncident(id:string):Promise<void>{
 requireUuid(id);await verifyOwnSession()
 const {error}=await supabase().rpc("upt_acknowledge_incident",{p_incident:id})
 if(error)throw new Error("incident_acknowledgement_rejected")
}
export function writesAvailable(){return MIGRATION_WRITES_ENABLED}
