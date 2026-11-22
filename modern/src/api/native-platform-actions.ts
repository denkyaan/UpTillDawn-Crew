// Independent second wave: exact IDs/field validation/RPC names from
// lib/actions/platform.ts, workplace-catalog.ts, onboarding.ts and uptilldawn.ts.
// The original Next.js actions and all visible UI remain unmodified.
// Do not use a client-declared role, service key or dynamic SQL function name.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export const nativePlatformAdminActionIds=[
 "lib/actions/platform.ts#setFeatureRollout",
 "lib/actions/platform.ts#snapshotPlatformConfiguration",
 "lib/actions/platform.ts#captureEventTemplate",
 "lib/actions/platform.ts#applyEventTemplate",
 "lib/actions/platform.ts#restorePlatformConfiguration",
 "lib/actions/platform.ts#saveAutomationRule",
 "lib/actions/workplace-catalog.ts#syncCatalogToEvent",
] as const
export const nativeMemberActionIds=[
 "lib/actions/onboarding.ts#completeEventOnboardingStep",
 "lib/actions/uptilldawn.ts#markNotificationRead",
 "lib/actions/uptilldawn.ts#acknowledgeBriefing",
 "lib/actions/uptilldawn.ts#acknowledgeInstruction",
] as const
export const nativeWaveTwoActionIds=[...nativePlatformAdminActionIds,...nativeMemberActionIds] as const
export type NativeWaveTwoActionId=typeof nativeWaveTwoActionIds[number]
const validIds=new Set<string>(nativeWaveTwoActionIds)
const adminIds=new Set<string>(nativePlatformAdminActionIds)
export const nativeWaveTwoAllowed=(id:string|null):id is NativeWaveTwoActionId=>
 typeof id==="string"&&validIds.has(id)

const uuid=z.string().uuid()
const text=(min:number,max:number)=>z.string().trim().min(min).max(max)
const int=(min:number,max:number)=>z.coerce.number().int().min(min).max(max)
const noStore={"Cache-Control":"private, no-store"}
const failure=(status:number,code:string)=>Response.json(
 {error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code},
 {status,headers:noStore}
)
const trimmed=(fd:FormData,name:string,max:number)=>
 String(fd.get(name)||"").trim().slice(0,max)||undefined
const optionalMinutes=(fd:FormData,name:string)=>{
 const raw=String(fd.get(name)||"").trim()
 return raw?int(1,43200).parse(raw):0
}

type Command={rpc:string;args:Record<string,unknown>;redirectOnData?:string}
export function originalWaveTwoCommand(id:NativeWaveTwoActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/platform.ts#setFeatureRollout":
   return {rpc:"upt_set_feature_rollout",args:{
    p_feature_key:text(1,120).parse(fd.get("feature_key")),
    p_enabled:fd.get("enabled")==="on",
    p_audience:z.enum(["all","admin","responsible","staff"]).parse(fd.get("audience")),
    p_rollout_percentage:int(0,100).parse(fd.get("rollout_percentage")),
    p_notes:trimmed(fd,"notes",1000)
   }}
  case "lib/actions/platform.ts#snapshotPlatformConfiguration":
   return {rpc:"upt_snapshot_platform_configuration",args:{p_note:trimmed(fd,"note",1000)}}
  case "lib/actions/platform.ts#captureEventTemplate":
   return {rpc:"upt_capture_event_template",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_name:text(3,200).parse(fd.get("name")),
    p_sections:fd.getAll("section").map(String)
   }}
  case "lib/actions/platform.ts#applyEventTemplate":
   return {rpc:"upt_apply_event_template",args:{
    p_template:uuid.parse(fd.get("template_id")),
    p_name:text(1,200).parse(fd.get("name")),
    p_start:z.string().datetime({offset:true}).parse(fd.get("start_at")),
    p_end:z.string().datetime({offset:true}).parse(fd.get("end_at")),
    p_venue:trimmed(fd,"venue",200),
    p_address:trimmed(fd,"address",500)
   },redirectOnData:"/events"}
  case "lib/actions/platform.ts#restorePlatformConfiguration":
   return {rpc:"upt_restore_platform_configuration",args:{p_version:uuid.parse(fd.get("version_id"))}}
  case "lib/actions/platform.ts#saveAutomationRule":{
   const channels=fd.getAll("channel").map(String).filter(s=>["in_app","push","email"].includes(s))
   return {rpc:"upt_save_automation_rule",args:{
    p_key:text(1,120).regex(/^[a-z0-9_-]+$/).parse(fd.get("automation_key")),
    p_enabled:fd.get("enabled")==="on",
    p_delay_minutes:int(0,43200).parse(fd.get("delay_minutes")||0),
    p_reminder_minutes:optionalMinutes(fd,"reminder_minutes"),
    p_escalation_minutes:optionalMinutes(fd,"escalation_minutes"),
    p_cooldown_minutes:int(0,43200).parse(fd.get("cooldown_minutes")||0),
    p_max_retries:int(0,20).parse(fd.get("max_retries")||0),
    p_channels:channels.length?channels:["in_app"]
   }}
  }
  case "lib/actions/workplace-catalog.ts#syncCatalogToEvent":
   return {rpc:"upt_sync_workplace_catalog_to_event",args:{p_event:uuid.parse(fd.get("event_id"))}}
  case "lib/actions/onboarding.ts#completeEventOnboardingStep":
   return {rpc:"upt_complete_event_onboarding_step",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_step:z.enum(["briefing","safety","map","workplace","responsible","inventory","confirmed"]).parse(fd.get("step"))
   }}
  case "lib/actions/uptilldawn.ts#markNotificationRead":
   return {rpc:"upt_mark_notification_read",args:{p_notification:uuid.parse(fd.get("notification_id"))}}
  case "lib/actions/uptilldawn.ts#acknowledgeBriefing":
   return {rpc:"upt_acknowledge_briefing",args:{p_briefing:uuid.parse(fd.get("id"))}}
  case "lib/actions/uptilldawn.ts#acknowledgeInstruction":
   return {rpc:"upt_acknowledge_personal_instruction",args:{p_instruction:uuid.parse(fd.get("id"))}}
 }
}

/** Authoritative session + exact signed payload; no live writes until independent
 * Main-QA browser tests, rollback SQL and full parity have passed. */
export async function nativeWaveTwoActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeWaveTwoActionId
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
  const {data:approved,error:approvedError}=await db.rpc("upt_is_approved")
  if(approvedError||approved!==true)return failure(422,"action_failed")
  if(adminIds.has(selected)){
   const {data:isAdmin,error:adminError}=await db.rpc("upt_is_admin",{uid:user.id})
   if(adminError||isAdmin!==true)return failure(422,"action_failed")
  }
  const command=originalWaveTwoCommand(selected,args[0])
  const {data,error}=await db.rpc(command.rpc,command.args)
  if(error)return failure(422,"action_failed")
  if(command.redirectOnData&&data)
   return Response.json({redirect:command.redirectOnData},{headers:noStore})
  return Response.json({value:encode(undefined,new FormData()),refresh:true},{headers:noStore})
 }catch{return failure(422,"action_failed")}
}
