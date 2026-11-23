// Fifth extracted original server-action wave: scheduling, attendance
// availability, responsible handovers and emergency contacts.
// Main/production behavior is unchanged: published write gate remains OFF.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export const nativeRosterAdminActionIds=[
 "lib/actions/uptilldawn.ts#createShift",
 "lib/actions/uptilldawn.ts#updateShift",
 "lib/actions/uptilldawn.ts#updateEventEmergencyInformation",
] as const
export const nativeRosterResponsibleActionIds=[
 "lib/actions/uptilldawn.ts#saveShiftHandover",
 "lib/actions/uptilldawn.ts#acceptShiftHandover",
] as const
export const nativeRosterMemberActionIds=[
 "lib/actions/uptilldawn.ts#setEventAvailability",
 "lib/actions/uptilldawn.ts#declineShift",
] as const
export const nativeRosterActionIds=[
 ...nativeRosterAdminActionIds,...nativeRosterResponsibleActionIds,...nativeRosterMemberActionIds
] as const
export type NativeRosterActionId=typeof nativeRosterActionIds[number]
const ids=new Set<string>(nativeRosterActionIds)
const adminIds=new Set<string>(nativeRosterAdminActionIds)
const responsibleIds=new Set<string>(nativeRosterResponsibleActionIds)
export const nativeRosterActionAllowed=(value:string|null):value is NativeRosterActionId=>
 typeof value==="string"&&ids.has(value)

const uuid=z.string().uuid()
const text=z.string().trim().min(1).max(200)
const shiftKind=z.enum(["event","setup","breakdown"])
const date=z.string().datetime({offset:true})
const noStore={"Cache-Control":"private, no-store"}
const fail=(status:number,code:string)=>Response.json({
 error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code
},{status,headers:noStore})
const optional=(fd:FormData,name:string,max:number)=>
 String(fd.get(name)||"").trim().slice(0,max)||undefined
type Command={rpc:string;args:Record<string,unknown>}
function span(fd:FormData){
 const start=date.parse(fd.get("start"))
 const end=date.parse(fd.get("end"))
 if(Date.parse(end)<=Date.parse(start))throw Error("End before start")
 return [start,end] as const
}
export function originalRosterCommand(id:NativeRosterActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/uptilldawn.ts#createShift":{
   const [start,end]=span(fd)
   return {rpc:"upt_create_shift",args:{
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_user:uuid.parse(fd.get("user_id")),
    p_role_name:text.parse(fd.get("role_name")||"Personeel"),
    p_start:start,p_end:end,
    p_overlap_allowed:fd.get("overlap_allowed")==="on",
    p_shift_kind:shiftKind.parse(fd.get("shift_kind")||"event"),
   }}
  }
  case "lib/actions/uptilldawn.ts#updateShift":{
   const [start,end]=span(fd)
   return {rpc:"upt_update_shift",args:{
    p_shift:uuid.parse(fd.get("shift_id")),
    p_role_name:text.parse(fd.get("role_name")||"Personeel"),
    p_start:start,p_end:end,
    p_overlap_allowed:fd.get("overlap_allowed")==="on",
    p_shift_kind:shiftKind.parse(fd.get("shift_kind")||"event"),
   }}
  }
  case "lib/actions/uptilldawn.ts#updateEventEmergencyInformation":
   return {rpc:"upt_upsert_event_emergency_information",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_emergency_number:String(fd.get("emergency_number")||"").trim().slice(0,40),
    p_first_aid_contact:optional(fd,"first_aid_contact",300),
    p_security_contact:optional(fd,"security_contact",300),
    p_assembly_point:optional(fd,"assembly_point",500),
    p_procedure:optional(fd,"procedure",5000)
   }}
  case "lib/actions/uptilldawn.ts#saveShiftHandover":{
   const incomingRaw=String(fd.get("incoming_user_id")||"").trim()
   const incoming=incomingRaw?uuid.parse(incomingRaw):undefined
   const markReady=String(fd.get("mark_ready")||"false")==="true"
   if(markReady&&!incoming)throw Error("Incoming responsible required")
   return {rpc:"upt_save_shift_handover",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_incoming:incoming,
    p_equipment_notes:optional(fd,"equipment_notes",2000),
    p_notes:optional(fd,"notes",4000),
    p_mark_ready:markReady
   }}
  }
  case "lib/actions/uptilldawn.ts#acceptShiftHandover":
   return {rpc:"upt_accept_shift_handover",args:{
    p_handover:uuid.parse(fd.get("handover_id"))
   }}
  case "lib/actions/uptilldawn.ts#setEventAvailability":
   return {rpc:"upt_set_event_availability_with_reason",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_response:z.enum(["can","cannot"]).parse(fd.get("response")),
    p_setup:z.enum(["yes","no"]).parse(fd.get("setup_available"))==="yes",
    p_breakdown:z.enum(["yes","no"]).parse(fd.get("breakdown_available"))==="yes",
    p_reason:optional(fd,"reason",1000),
   }}
  case "lib/actions/uptilldawn.ts#declineShift":{
   const reason=String(fd.get("reason")||"").trim().slice(0,500)
   if(!reason)throw Error("Decline reason required")
   return {rpc:"upt_respond_shift",args:{
    p_shift:uuid.parse(fd.get("shift_id")),
    p_response:"declined",p_reason:reason
   }}
  }
 }
}
export async function nativeRosterActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeRosterActionId
):Promise<Response>{
 const url=new URL(request.url),site=request.headers.get("sec-fetch-site")
 if(request.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))
  return fail(403,"migration_disabled")
 if(!(request.headers.get("content-type")||"").startsWith("multipart/form-data;"))
  return fail(415,"invalid_content_type")
 let body:FormData
 try{body=await boundedMigrationForm(request,64*1024)}
 catch{return fail(413,"invalid_form")}
 if(body.get("_id")!==selected)return fail(404,"unknown_action")
 const encodedArgs=body.get("_args")
 if(typeof encodedArgs!=="string"||encodedArgs.length>1024*1024)
  return fail(413,"invalid_arguments")
 let args:unknown
 try{args=decode(JSON.parse(encodedArgs),body)}
 catch{return fail(400,"invalid_arguments")}
 if(!Array.isArray(args)||args.length!==1||!(args[0] instanceof FormData))
  return fail(400,"invalid_arguments")
 try{
  const {data:{user},error:authError}=await db.auth.getUser()
  if(authError||!user)return fail(401,"authentication_required")
  if(adminIds.has(selected)){
   const {data:approved,error:approvalError}=await db.rpc("upt_is_approved")
   if(approvalError||approved!==true)return fail(422,"action_failed")
   const {data:admin,error:adminError}=await db.rpc("upt_is_admin",{uid:user.id})
   if(adminError||admin!==true)return fail(422,"action_failed")
  }else{
   const {data:rows,error:profileError}=await db.rpc("upt_current_profile")
   const profile=Array.isArray(rows)?rows[0]:null
   if(profileError||profile?.approved!==true||profile?.account_blocked===true)
    return fail(422,"action_failed")
   if(responsibleIds.has(selected)){
    const {data:effective}=await db.rpc("upt_current_effective_role")
    const role=typeof effective==="string"&&effective?effective:profile.role
    if(role!=="responsible_lead")return fail(422,"action_failed")
   }
  }
  const cmd=originalRosterCommand(selected,args[0])
  const {error}=await db.rpc(cmd.rpc,cmd.args)
  if(error)return fail(422,"action_failed")
  return Response.json({value:encode(undefined,new FormData()),refresh:true},{headers:noStore})
 }catch{return fail(422,"action_failed")}
}
