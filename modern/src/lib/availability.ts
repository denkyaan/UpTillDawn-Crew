import {supabase} from "./supabase"
import {parseIdentity,isActive} from "../shared/identity"

export type AvailabilityResponse="can"|"cannot"
export type AvailabilityForm={eventId:string;response:AvailabilityResponse;setup:boolean;breakdown:boolean;reason?:string}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateAvailability(form:AvailabilityForm){
 if(!UUID.test(form.eventId))throw new Error("invalid_event_id")
 if(form.response!=="can"&&form.response!=="cannot")throw new Error("invalid_response")
 if(typeof form.setup!=="boolean"||typeof form.breakdown!=="boolean")throw new Error("invalid_availability")
 const reason=(form.reason||"").trim()
 if(reason.length>1000)throw new Error("invalid_reason")
 return {...form,reason:reason||null}
}

// Only original, security-audited, auth.uid-scoped DB logic may write. Neither
// the browser nor Hono can assign an arbitrary user ID or bypass deadlines.
export async function setOwnEventAvailability(input:AvailabilityForm):Promise<void>{
 if(import.meta.env.VITE_MIGRATION_ALLOW_WRITES!=="true")
  throw new Error("migration_writes_not_enabled")
 const form=validateAvailability(input)
 const db=supabase()
 const {data:{session}}=await db.auth.getSession()
 if(!session)throw new Error("authentication_required")
 const {data:rows,error:identityError}=await db.rpc("upt_current_session_context")
 const identity=parseIdentity(Array.isArray(rows)?rows[0]:null)
 if(identityError||!identity||!isActive(identity)||identity.id!==session.user.id)
  throw new Error("authorization_failed")
 const {error}=await db.rpc("upt_set_event_availability_with_reason",{
  p_event:form.eventId,
  p_response:form.response,
  p_setup:form.setup,
  p_breakdown:form.breakdown,
  p_reason:form.reason,
 })
 if(error)throw new Error("availability_rejected")
}
