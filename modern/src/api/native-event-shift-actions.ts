// Third independent, disabled-by-default server-action wave: event lifecycle
// and self-service shift changes. Exact original source IDs and Supabase RPCs.
// Never trust a browser role or expose privileged service-role credentials.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export const nativeEventAdminActionIds=[
 "lib/actions/events.ts#closeEvent",
 "lib/actions/events.ts#archiveEvent",
 "lib/actions/events.ts#restoreEvent",
 "lib/actions/uptilldawn.ts#decideShiftChange",
 "lib/actions/uptilldawn.ts#cancelShift",
 "lib/actions/uptilldawn.ts#reassignShift",
] as const
export const nativeShiftMemberActionIds=[
 "lib/actions/uptilldawn.ts#confirmShift",
 "lib/actions/uptilldawn.ts#requestShiftReplacement",
 "lib/actions/uptilldawn.ts#requestShiftSwap",
 "lib/actions/uptilldawn.ts#claimOpenShift",
 "lib/actions/uptilldawn.ts#respondShiftChange",
 "lib/actions/uptilldawn.ts#cancelShiftChange",
] as const
export const nativeWaveThreeActionIds=[...nativeEventAdminActionIds,...nativeShiftMemberActionIds] as const
export type NativeWaveThreeActionId=typeof nativeWaveThreeActionIds[number]
const exactIds=new Set<string>(nativeWaveThreeActionIds)
const adminIds=new Set<string>(nativeEventAdminActionIds)
export const nativeWaveThreeAllowed=(id:string|null):id is NativeWaveThreeActionId=>
 typeof id==="string"&&exactIds.has(id)

const uuid=z.string().uuid()
const enumResponse=z.enum(["accepted","declined"])
const enumDecision=z.enum(["approved","rejected"])
const reason=(fd:FormData,max=500)=>String(fd.get("reason")||"").trim().slice(0,max)
const requiredReason=(fd:FormData)=>z.string().trim().min(3).max(500).parse(fd.get("reason"))
const noStore={"Cache-Control":"private, no-store"}
const failure=(status:number,code:string)=>Response.json(
 {error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code},
 {status,headers:noStore}
)
type Command={rpc:string;args:Record<string,unknown>}

// Follow each original lib/actions/{events,uptilldawn}.ts RPC argument name.
// Do not silently add a target user ID, privileged role, implicit check-in,
// or side-effect unrelated to the action.
export function originalWaveThreeCommand(id:NativeWaveThreeActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/events.ts#closeEvent":{
   const why=String(fd.get("reason")||"").trim()||undefined
   return {rpc:"upt_close_event",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_force:fd.get("force")==="on",p_reason:why
   }}
  }
  case "lib/actions/events.ts#archiveEvent":{
   const event=uuid.parse(fd.get("event_id"))
   const why=String(fd.get("reason")||"").trim()
   return fd.get("force")==="on"
    ?{rpc:"upt_force_archive_event",args:{p_event:event,p_reason:why}}
    :{rpc:"upt_archive_event",args:{p_event:event}}
  }
  case "lib/actions/events.ts#restoreEvent":{
   const why=String(fd.get("reason")||"").trim()||undefined
   return {rpc:"upt_restore_event",args:{
    p_event:uuid.parse(fd.get("event_id")),p_reason:why
   }}
  }
  case "lib/actions/uptilldawn.ts#decideShiftChange":{
   const decision=enumDecision.parse(fd.get("decision"))
   const why=reason(fd)
   if(decision==="rejected"&&why.length<3)throw Error("Invalid rejection reason")
   return {rpc:"upt_decide_shift_change",args:{
    p_request:uuid.parse(fd.get("request_id")),p_decision:decision,
    ...(why?{p_reason:why}:{})
   }}
  }
  case "lib/actions/uptilldawn.ts#cancelShift":{
   const why=reason(fd)
   return {rpc:"upt_cancel_shift",args:{
    p_shift:uuid.parse(fd.get("shift_id")),...(why?{p_reason:why}:{})
   }}
  }
  case "lib/actions/uptilldawn.ts#reassignShift":
   return {rpc:"upt_reassign_shift",args:{
    p_shift:uuid.parse(fd.get("shift_id")),
    p_user:uuid.parse(fd.get("user_id")),p_reason:requiredReason(fd)
   }}
  case "lib/actions/uptilldawn.ts#confirmShift":
   return {rpc:"upt_confirm_shift",args:{p_shift:uuid.parse(fd.get("shift_id"))}}
  case "lib/actions/uptilldawn.ts#requestShiftReplacement":
   return {rpc:"upt_request_shift_change",args:{
    p_type:"replacement",p_shift:uuid.parse(fd.get("shift_id")),
    p_replacement:uuid.parse(fd.get("replacement_user_id")),p_reason:requiredReason(fd)
   }}
  case "lib/actions/uptilldawn.ts#requestShiftSwap":
   return {rpc:"upt_request_shift_change",args:{
    p_type:"swap",p_shift:uuid.parse(fd.get("shift_id")),
    p_replacement:uuid.parse(fd.get("replacement_user_id")),
    p_target_shift:uuid.parse(fd.get("target_shift_id")),p_reason:requiredReason(fd)
   }}
  case "lib/actions/uptilldawn.ts#claimOpenShift":
   return {rpc:"upt_request_shift_change",args:{
    p_type:"claim-open-shift",p_shift:uuid.parse(fd.get("shift_id")),
    p_reason:requiredReason(fd)
   }}
  case "lib/actions/uptilldawn.ts#respondShiftChange":
   return {rpc:"upt_respond_shift_change",args:{
    p_request:uuid.parse(fd.get("request_id")),p_response:enumResponse.parse(fd.get("response"))
   }}
  case "lib/actions/uptilldawn.ts#cancelShiftChange":
   return {rpc:"upt_cancel_shift_change",args:{p_request:uuid.parse(fd.get("request_id"))}}
 }
}

/** Signed Supabase user, DB approval and original owner/role/RLS remain
 * mandatory. Public deployment flag is strictly false; no mutation is
 * reachable on the deployed Main-QA Worker. */
export async function nativeWaveThreeActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeWaveThreeActionId
):Promise<Response>{
 const url=new URL(request.url),site=request.headers.get("sec-fetch-site")
 if(request.headers.get("origin")!==url.origin||(site&&site!=="same-origin"))
  return failure(403,"migration_disabled")
 if(!(request.headers.get("content-type")||"").startsWith("multipart/form-data;"))
  return failure(415,"invalid_content_type")
 let body:FormData
 try{body=await boundedMigrationForm(request,64*1024)}
 catch{return failure(413,"invalid_form")}
 if(body.get("_id")!==selected)return failure(404,"unknown_action")
 const payload=body.get("_args")
 if(typeof payload!=="string"||payload.length>1024*1024)
  return failure(413,"invalid_arguments")
 let args:unknown
 try{args=decode(JSON.parse(payload),body)}
 catch{return failure(400,"invalid_arguments")}
 if(!Array.isArray(args)||args.length!==1||!(args[0] instanceof FormData))
  return failure(400,"invalid_arguments")
 try{
  const {data:{user},error:authError}=await db.auth.getUser()
  if(authError||!user)return failure(401,"authentication_required")
  // The original admin action checks both approved and upt_is_admin.
  // The original employee action checks approved AND account_blocked=false.
  if(adminIds.has(selected)){
   const {data:approved,error:approvalError}=await db.rpc("upt_is_approved")
   if(approvalError||approved!==true)return failure(422,"action_failed")
   const {data:admin,error:adminError}=await db.rpc("upt_is_admin",{uid:user.id})
   if(adminError||admin!==true)return failure(422,"action_failed")
  }else{
   const {data:profiles,error:profileError}=await db.rpc("upt_current_profile")
   const profile=Array.isArray(profiles)?profiles[0]:null
   if(profileError||profile?.approved!==true||profile?.account_blocked!==false)
    return failure(422,"action_failed")
  }
  const command=originalWaveThreeCommand(selected,args[0])
  const {error}=await db.rpc(command.rpc,command.args)
  if(error)return failure(422,"action_failed")
  return Response.json({value:encode(undefined,new FormData()),refresh:true},{headers:noStore})
 }catch{return failure(422,"action_failed")}
}
