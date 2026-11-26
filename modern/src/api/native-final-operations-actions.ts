// Original inline event-task, promotion, roster and administration mutations.
// These are selected by immutable source IDs; the Worker enforces the public
// write-disable gate and the original signed database subject before dispatch.
import {parseBrusselsRosterTime} from "../../../lib/administration/roster-local-time.ts"
import {validateUploadSecurity} from "../../../lib/upload-security.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,done,failure,type MegaDb,type AuthContext} from "./native-mega-helpers.ts"

export const finalOperationsActionIds=[
 "app/(app)/admin/management/event-tasks/page.tsx#updateAssignment",
 "app/(app)/admin/management/event-tasks/page.tsx#editEventTask",
 "app/(app)/portals/administration/promotion-tasks/page.tsx#assignPromotionTask",
 "app/(app)/portals/administration/promotion-tasks/page.tsx#removePromotionAssignment",
 "app/(app)/portals/administration/promotion-discipline/page.tsx#unblock",
 "app/(app)/portals/administration/promotion-discipline/page.tsx#registerReference",
 "app/(app)/portals/administration/promotion-discipline/page.tsx#reviewEvidence",
 "app/(app)/portals/promotion/tasks/page.tsx#changePromotionTaskStatus",
 "app/(app)/portals/promotion/tasks/page.tsx#submitPromotionEvidence",
 "app/(app)/portals/administration/rosters/page.tsx#createProposal",
 "app/(app)/portals/administration/rosters/page.tsx#shiftAction",
 "app/(app)/portals/administration/rosters/page.tsx#planNewShift",
 "app/(app)/portals/administration/rosters/page.tsx#changeStatus",
 "app/(app)/portals/administration/modules/[slug]/page.tsx#saveAdministrationEventDraft",
 "app/(app)/portals/administration/modules/[slug]/page.tsx#markAdministrationNotificationRead",
 "app/(app)/portals/administration/modules/[slug]/page.tsx#markAllAdministrationNotificationsRead",
] as const
export type FinalOperationsActionId=typeof finalOperationsActionIds[number]
const registered=new Set<string>(finalOperationsActionIds)
export const finalOperationsActionAllowed=(id:string|null):id is FinalOperationsActionId=>
 typeof id==="string"&&registered.has(id)
function chk(r:{error?:unknown}){if(r.error)throw Error("Mutation rejected by RLS/RPC")}
const str=(fd:FormData,key:string)=>String(fd.get(key)??"").trim()
function ownAccount(a:AuthContext){if((!a.approved||a.account_blocked)&&!a.is_owner)throw Error("Account denied")}
async function admin(db:MegaDb,a:AuthContext){
 ownAccount(a)
 if(!a.is_owner&&!await approvedAdmin(db,a))throw Error("Admin permission required")
}
async function portal(db:MegaDb,a:AuthContext,which:"promotion"|"administration"){
 ownAccount(a)
 if(a.is_owner||await approvedAdmin(db,a))return
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 const role=which==="promotion"?"promoter":"administrative_staff"
 if(error||!Array.isArray(data)||!data.some((r:any)=>r.portal===which&&
  (r.role===role||r.role==="admin")&&r.approved===true&&r.revoked_at===null))
  throw Error("Portal access denied")
}
async function photo(db:MegaDb,actor:string,file:File,type:"promotion"|"promotion-reference"){
 const security=await validateUploadSecurity(file,{allowDocuments:false})
 if(security.kind!=="image")throw Error("Image required")
 // Original upload flow checks PNG IHDR rather than only the eight-byte magic.
 if(file.type==="image/png"){
  const bytes=new Uint8Array(await file.slice(0,24).arrayBuffer())
  if(bytes.length<24||String.fromCharCode(...bytes.slice(12,16))!=="IHDR")
   throw Error("PNG IHDR missing")
 }
 const bytes=await file.arrayBuffer()
 const digest=await crypto.subtle.digest("SHA-256",bytes)
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")
 const path=actor+"/"+type+"/"+crypto.randomUUID()+"."+security.extension
 chk(await db.storage.from("work-media").upload(path,file,{contentType:file.type,upsert:false}))
 return {path,hash}
}
async function markAll(db:MegaDb,a:AuthContext){
 const cutoff=new Date().toISOString()
 for(;;){
  const {data,error}=await db.from("crew_notifications").select("id")
   .eq("user_id",a.id).is("read_at",null).lte("created_at",cutoff)
   .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50)
  if(error)throw Error("Notification selection failed")
  if(!data?.length)break
  for(let i=0;i<data.length;i+=5){
   const results=await Promise.all(data.slice(i,i+5).map((r:{id:string})=>
    db.rpc("upt_mark_notification_read",{p_notification:uuid(r.id)})))
   results.forEach(chk)
  }
  if(data.length<50)break
 }
}
export async function finalOperationsActionResponse(
 req:Request,db:NativeAdminActionDb,selected:FinalOperationsActionId
):Promise<Response>{
 const name=selected.split("#")[1],prefix=selected.split("#")[0]
 const hasPhoto=name==="registerReference"||name==="submitPromotionEvidence"
 const noForm=name==="markAllAdministrationNotificationsRead"
 const parsed=await parseMegaRequest(req,db,selected,noForm?-1:0,hasPhoto?12*1024*1024:64*1024)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 try{
  // Every original administrative inline action checks signed real Admin or
  // active, approved Administration assignment; source SQL/RLS also checks.
  if(prefix.includes("portals/promotion/tasks"))await portal(client,actor,"promotion")
  else if(prefix.includes("admin/management/event-tasks")||
          prefix.includes("promotion-discipline")||
          prefix.includes("administration/promotion-tasks"))
   await admin(client,actor)
  else await portal(client,actor,"administration")
  switch(name){
   case "updateAssignment":{
    const remove=fd.get("operation")==="remove"
    if(remove)chk(await client.rpc("upt_remove_task_assignment",{
     p_assignment:uuid(fd.get("assignment_id"))
    }))
    else{
     const task=uuid(fd.get("task_id")),user=uuid(fd.get("user_id"))
     const {data,error}=await client.from("tasks").select("event_id").eq("id",task).maybeSingle()
     if(error||!data?.event_id)throw Error("Event task required")
     chk(await client.rpc("upt_assign_task",{p_task:task,p_user:user}))
    }
    break
   }
   case "editEventTask":{
    const task=uuid(fd.get("task_id")),title=str(fd,"title"),description=String(fd.get("description")||"")
    if(!title||title.length>200||description.length>4000)throw Error("Invalid task")
    chk(await client.rpc("upt_admin_update_event_task",{p_task:task,p_title:title,p_description:description}))
    break
   }
   case "assignPromotionTask":{
    const task=uuid(fd.get("task_id")),user=uuid(fd.get("user_id"))
    const {data:t,error:te}=await client.from("tasks").select("id,event_id").eq("id",task).maybeSingle()
    if(te||!t?.event_id)throw Error("Only event promotion tasks")
    const [member,profile]=await Promise.all([
     client.from("event_members").select("user_id").eq("event_id",t.event_id).eq("user_id",user).maybeSingle(),
     client.rpc("upt_admin_profiles").select("id").eq("id",user).eq("approved",true).maybeSingle()
    ])
    if(member.error||profile.error||!member.data||!profile.data)throw Error("Approved event member required")
    chk(await client.rpc("upt_assign_task",{p_task:task,p_user:user}))
    break
   }
   case "removePromotionAssignment":{
    const assignment=uuid(fd.get("assignment_id"))
    const {data,error}=await client.from("task_assignments").select("task_id").eq("id",assignment).maybeSingle()
    if(error||!data)throw Error("Assignment missing")
    const task=await client.from("tasks").select("id,event_id,promotion_only").eq("id",data.task_id).maybeSingle()
    if(task.error||!task.data)throw Error("Task missing")
    // Source delegates general promotion tasks to the original general RPC.
    if(task.data.event_id===null&&!task.data.promotion_only)throw Error("General task not promotable")
    chk(await client.rpc("upt_remove_task_assignment",{p_assignment:assignment}))
    break
   }
   case "unblock":{
    const reason=str(fd,"reason")
    if(reason.length<10)throw Error("A reason is required")
    chk(await client.rpc("upt_admin_unblock_promotion",{p_user:uuid(fd.get("user")),p_reason:reason}))
    break
   }
   case "reviewEvidence":{
    const status=str(fd,"status"),reason=str(fd,"reason")
    if(!["verified","rejected","inconclusive"].includes(status)||reason.length<10)
     throw Error("Invalid evidence review")
    chk(await client.rpc("upt_admin_review_promotion_evidence",{
     p_evidence:uuid(fd.get("evidence_id")),p_status:status,p_details:reason
    }))
    break
   }
   case "registerReference":{
    const task=uuid(fd.get("task_id")),file=fd.get("reference")
    if(!(file instanceof File))throw Error("Reference image required")
    const proof=await photo(client,actor.id,file,"promotion-reference")
    try{chk(await client.rpc("upt_admin_register_promotion_reference",{
     p_task:task,p_path:proof.path,p_sha256:proof.hash
    }))}catch(e){await client.storage.from("work-media").remove([proof.path]);throw e}
    break
   }
   case "changePromotionTaskStatus":
   case "submitPromotionEvidence":{
    const id=uuid(fd.get("assignment_id"))
    const {data:blocked,error:blockError}=await client.rpc("upt_promotion_is_blocked")
    if(blockError||blocked)throw Error("Promotion blocked")
    const {data:assignment,error}=await client.from("task_assignments")
     .select("id,status,confirmed_at").eq("id",id).eq("user_id",actor.id).maybeSingle()
    if(error||!assignment)throw Error("Assignment not owned")
    if(name==="changePromotionTaskStatus"){
     if(fd.get("status")!=="IN PROGRESS"||
       !(assignment.status==="NOT STARTED"||assignment.status==="IN PROGRESS"&&assignment.confirmed_at===null))
      throw Error("Invalid status transition")
     chk(await client.rpc("upt_start_promotion_task",{p_assignment:id}))
    }else{
     if(assignment.status!=="IN PROGRESS")throw Error("Only started tasks accept evidence")
     const file=fd.get("evidence")
     if(!(file instanceof File))throw Error("Evidence photo required")
     const proof=await photo(client,actor.id,file,"promotion")
     try{chk(await client.rpc("upt_submit_promotion_evidence",{
      p_assignment:id,p_storage_path:proof.path,p_sha256:proof.hash
     }))}catch(e){await client.storage.from("work-media").remove([proof.path]);throw e}
    }
    break
   }
   case "createProposal":{
    const event=uuid(fd.get("event")),title=str(fd,"title"),detail=String(fd.get("details")||"")
    if(!title||title.length>180||detail.length>2000)throw Error("Invalid proposal")
    const start=parseBrusselsRosterTime(str(fd,"start")),end=parseBrusselsRosterTime(str(fd,"end"))
    if(end<=start)throw Error("Invalid shift time interval")
    chk(await client.rpc("upt_admin_roster_create",{
     p_event:event,p_title:title,p_details:detail,p_start:start.toISOString(),p_end:end.toISOString()
    }))
    break
   }
   case "shiftAction":{
    const id=uuid(fd.get("id")),action=str(fd,"action")
    if(!["target","apply"].includes(action))throw Error("Invalid shift change")
    if(action==="apply"&&!actor.is_owner&&!await approvedAdmin(client,actor))
     throw Error("Admin approval required")
    if(action==="target"){
     chk(await client.rpc("upt_admin_roster_target",{p_id:id,p_shift:uuid(fd.get("shift"))}))
    }else{
     chk(await client.rpc("upt_admin_roster_apply",{p_id:id}))
    }
    break
   }
   case "planNewShift":{
    const id=uuid(fd.get("id")),workplace=uuid(fd.get("workplace")),user=uuid(fd.get("staff"))
    const role=str(fd,"role"),kind=str(fd,"kind")||"event"
    if(!role||role.length>200||!["event","setup","breakdown"].includes(kind))
     throw Error("Invalid shift")
    chk(await client.rpc("upt_admin_roster_plan_new",{
     p_id:id,p_workplace:workplace,p_user:user,p_role_name:role,
     p_shift_kind:kind,p_overlap_allowed:fd.get("overlap")==="on"
    }))
    break
   }
   case "changeStatus":{
    const id=uuid(fd.get("id")),action=str(fd,"action"),note=str(fd,"note")
    if(!["submit","approve","reject"].includes(action)||note.length>2000||
      action==="reject"&&!note)throw Error("Invalid roster status")
    if(action!=="submit"){
     if(!actor.is_owner&&!await approvedAdmin(client,actor))throw Error("Admin review only")
     const {data,error}=await client.from("admin_roster_proposals").select("created_by,status")
      .eq("id",id).maybeSingle()
     if(error||!data||data.status!=="submitted"||data.created_by===actor.id)
      throw Error("Self-approval or invalid status")
    }
    if(action==="submit")chk(await client.rpc("upt_admin_roster_submit",{p_id:id}))
    else chk(await client.rpc("upt_admin_roster_review",{
     p_id:id,p_approve:action==="approve",p_note:note
    }))
    break
   }
   case "saveAdministrationEventDraft":{
    const name=str(fd,"name"),venue=str(fd,"venue")
    const rawStart=str(fd,"start_at"),rawEnd=str(fd,"end_at"),event=str(fd,"event_id")
    const start=new Date(rawStart),end=new Date(rawEnd)
    if(name.length<3||name.length>200||venue.length>200||!rawStart||!rawEnd||
      !Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
      end.getTime()<=start.getTime())throw Error("Invalid event draft")
    chk(await client.rpc("upt_administration_save_event_draft",{
     p_event_id:event?uuid(event):null,p_name:name,p_start_at:start.toISOString(),
     p_end_at:end.toISOString(),p_venue:venue||null
    }))
    return Response.json({redirect:"/portals/administration/modules/events"},{headers:{"Cache-Control":"private, no-store"}})
   }
   case "markAdministrationNotificationRead":{
    const raw=str(fd,"notification_id")
    if(raw)chk(await client.rpc("upt_mark_notification_read",{p_notification:uuid(raw)}))
    break
   }
   case "markAllAdministrationNotificationsRead":
    await markAll(client,actor);break
   default:return failure(404,"unknown_action")
  }
  return done()
 }catch{return failure(422,"action_failed")}
}
