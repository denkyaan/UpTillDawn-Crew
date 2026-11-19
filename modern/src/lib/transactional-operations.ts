import {supabase} from "./supabase"
import {verifyOwnSession,requireUuid} from "./operational-writes"
import {parseQrResult,validIncident,normalizedReviewReason,type QrResult,type IncidentInput} from "../shared/workflow-contracts"
export type {QrResult,IncidentInput} from "../shared/workflow-contracts"

export async function requestOwnQr(options:{
 contactConfirmed?:boolean;remote?:boolean;earlyReason?:string
}={}):Promise<QrResult>{
 if(!navigator.onLine)throw new Error("qr_requires_online")
 if(options.contactConfirmed!==undefined&&typeof options.contactConfirmed!=="boolean")throw new Error("invalid_contact")
 if(options.remote!==undefined&&typeof options.remote!=="boolean")throw new Error("invalid_remote")
 const earlyReason=options.earlyReason?.trim()||null
 if(earlyReason&&earlyReason.length>500)throw new Error("invalid_early_reason")
 await verifyOwnSession()
 const {data,error}=await supabase().rpc("upt_qr_request",{
  p_contact_confirmed:options.contactConfirmed??null,
  p_remote:options.remote??false,
  p_early_reason:earlyReason,
 })
 if(error)throw new Error("qr_request_rejected")
 return parseQrResult(data)
}

export async function submitOwnTimesheet(eventId:string):Promise<string>{
 requireUuid(eventId)
 await verifyOwnSession()
 const {data,error}=await supabase().rpc("upt_submit_timesheet",{p_event:eventId})
 if(error||typeof data!=="string")throw new Error("timesheet_submit_rejected")
 return requireUuid(data)
}
export async function reviewAllowedTimesheet(timesheetId:string,approve:boolean,reason?:string):Promise<void>{
 requireUuid(timesheetId)
 if(typeof approve!=="boolean")throw new Error("invalid_decision")
 const clean=normalizedReviewReason(approve,reason)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_review_timesheet",{
  p_timesheet:timesheetId,p_approve:approve,p_reason:approve?undefined:clean,
 })
 if(error)throw new Error("timesheet_review_rejected")
}
export async function lockApprovedTimesheet(timesheetId:string):Promise<void>{
 requireUuid(timesheetId)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_lock_timesheet",{p_timesheet:timesheetId})
 if(error)throw new Error("timesheet_lock_rejected")
}

export async function submitOwnIncident(input:IncidentInput):Promise<string>{
 if(!navigator.onLine)throw new Error("incident_requires_online")
 const payload=validIncident(input)
 await verifyOwnSession()
 // The established sync RPC checks current event/workplace access, audits
 // every submitted incident and deduplicates by operation UUID + payload.
 const {data,error}=await supabase().rpc("upt_sync_operation",{
  p_id:input.operationId,p_type:"incident",p_payload:payload,
 })
 if(error||!data||typeof data!=="object"||typeof (data as Record<string,unknown>).id!=="string")
  throw new Error("incident_unconfirmed")
 return requireUuid((data as Record<string,string>).id)
}
