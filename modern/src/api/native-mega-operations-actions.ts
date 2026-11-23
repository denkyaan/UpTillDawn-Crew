// Wave seven B: ten direct-table and post-RPC original admin/crew operations.
// Source UI and server-side flag stay unchanged; real Main-QA writes disabled.
import {z} from "zod"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,option,done,failure} from "./native-mega-helpers.ts"

export const megaOperationsActionIds=[
 "lib/actions/platform.ts#savePayRate",
 "lib/actions/platform.ts#createKnowledgeArticle",
 "lib/actions/platform.ts#createQrResource",
 "lib/actions/platform.ts#updateAssetMetadata",
 "lib/actions/uptilldawn.ts#removeOperationalChecklistItem",
 "lib/actions/uptilldawn.ts#reopenOperationalChecklistItem",
 "lib/actions/uptilldawn.ts#archiveEventDocument",
 "lib/actions/uptilldawn.ts#removeTaskAssignment",
 "lib/actions/uptilldawn.ts#markAllNotificationsRead",
 "lib/actions/uptilldawn.ts#updateEvent",
] as const
export type MegaOperationsActionId=typeof megaOperationsActionIds[number]
const ids=new Set<string>(megaOperationsActionIds)
export const megaOperationsAllowed=(id:string|null):id is MegaOperationsActionId=>
 typeof id==="string"&&ids.has(id)
const title=z.string().trim().min(1).max(200)
const date=z.string().datetime({offset:true})
const manager=(role:string)=>["admin","responsible_lead"].includes(role)
const toCents=(raw:unknown,max=10000000)=>
 Math.round(z.coerce.number().min(0).max(max).parse(raw)*100)
function optionalUuid(fd:FormData,key:string){
 const raw=String(fd.get(key)||"")
 return raw?uuid(raw):null
}
function eventLocation(fd:FormData){
 const venue=String(fd.get("venue")||"").trim().slice(0,200)
 const address=String(fd.get("address")||"").trim().slice(0,500)
 const latitudeRaw=String(fd.get("latitude")||"").trim()
 const longitudeRaw=String(fd.get("longitude")||"").trim()
 const latitude=latitudeRaw?z.coerce.number().min(-90).max(90).parse(latitudeRaw):null
 const longitude=longitudeRaw?z.coerce.number().min(-180).max(180).parse(longitudeRaw):null
 if((latitude===null)!==(longitude===null))throw Error("Invalid map location")
 return {venue,address,latitude,longitude}
}

export async function megaOperationsResponse(
 req:Request,db:NativeAdminActionDb,selected:MegaOperationsActionId
):Promise<Response>{
 const isMarkAll=selected==="lib/actions/uptilldawn.ts#markAllNotificationsRead"
 const parsed=await parseMegaRequest(req,db,selected,isMarkAll?-1:0)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 const id=selected.split("#")[1]
 const effectiveRole=actor.effective_role||actor.role
 const isAdminWorkflow=[
  "savePayRate","createKnowledgeArticle","createQrResource",
  "updateAssetMetadata","updateEvent"
 ].includes(id)
 if(isAdminWorkflow&&!await approvedAdmin(client,actor))
  return failure(422,"action_failed")
 if(["removeOperationalChecklistItem","removeTaskAssignment","archiveEventDocument"].includes(id)
  &&!manager(effectiveRole))return failure(422,"action_failed")
 try{
  switch(id){
   case "savePayRate":{
    const hourly=z.coerce.number().min(0).max(100000).parse(fd.get("hourly_rate"))
    const multiplier=z.coerce.number().min(1).max(5).parse(fd.get("employer_multiplier")||1)
    const effective=z.string().date().parse(fd.get("effective_from"))
    const {error}=await client.from("staff_pay_rates").insert({
     user_id:uuid(fd.get("user_id")),hourly_rate_cents:Math.round(hourly*100),
     employer_cost_multiplier_bps:Math.round(multiplier*10000),
     currency:"EUR",effective_from:effective,notes:option(fd,"notes",1000)||null,
     created_by:actor.id
    })
    if(error)throw Error("Pay rate insert rejected")
    return done()
   }
   case "createKnowledgeArticle":{
    const body=z.string().trim().min(1).max(20000).parse(fd.get("body"))
    const {error}=await client.from("knowledge_articles").insert({
     event_id:optionalUuid(fd,"event_id"),
     workplace_id:optionalUuid(fd,"workplace_id"),
     category:option(fd,"category",120)||null,
     title:title.parse(fd.get("title")),body,
     offline_critical:fd.get("offline_critical")==="on",is_published:true,
     created_by:actor.id
    })
    if(error)throw Error("Knowledge insert rejected")
    return done()
   }
   case "createQrResource":{
    const resource=z.enum(["workplace","inventory","document","checklist","task","knowledge"])
     .parse(fd.get("resource_type"))
    const {error}=await client.from("qr_resources").insert({
     event_id:optionalUuid(fd,"event_id"),
     workplace_id:optionalUuid(fd,"workplace_id"),
     resource_type:resource,resource_id:optionalUuid(fd,"resource_id"),
     title:title.parse(fd.get("title")),
     route:z.string().trim().min(1).max(500).parse(fd.get("route")),
     active:true,created_by:actor.id
    })
    if(error)throw Error("QR insert rejected")
    return done()
   }
   case "updateAssetMetadata":{
    const reorder=z.coerce.number().int().min(0).max(100000)
     .parse(fd.get("reorder_threshold")||0)
    const raw=String(fd.get("unit_cost")||"").trim()
    const {error}=await client.from("inventory_items").update({
     asset_code:option(fd,"asset_code",120)||null,
     barcode:option(fd,"barcode",200)||null,
     serial_number:option(fd,"serial_number",200)||null,
     location_label:option(fd,"location_label",300)||null,
     maintenance_due_at:option(fd,"maintenance_due_at",120)||null,
     reorder_threshold:reorder,
     unit_cost_cents:raw?toCents(raw):null,
     asset_notes:option(fd,"asset_notes",4000)||null
    }).eq("id",uuid(fd.get("item_id")))
    if(error)throw Error("Asset update rejected")
    return done()
   }
   case "removeOperationalChecklistItem":
   case "reopenOperationalChecklistItem":{
    const item=uuid(fd.get("item_id"))
    const {data,error:lookup}=await client.from("checklist_items")
     .select("photo_path").eq("id",item).maybeSingle()
    if(lookup)throw Error("Checklist read failed")
    const rpc=id==="removeOperationalChecklistItem"?
     {name:"upt_remove_operational_checklist_item",args:{p_item:item}}:
     {name:"upt_set_operational_checklist_item",args:{p_item:item,p_complete:false}}
    const {error}=await client.rpc(rpc.name,rpc.args)
    if(error)throw Error("Checklist RPC rejected")
    if(data?.photo_path)await client.storage.from("work-media").remove([data.photo_path])
    return done()
   }
   case "archiveEventDocument":{
    const {data:path,error}=await client.rpc("upt_archive_event_document",{
     p_document:uuid(fd.get("document_id"))
    })
    if(error)throw Error("Event document archive rejected")
    if(path)await client.storage.from("work-media").remove([path])
    return done()
   }
   case "removeTaskAssignment":{
    const assignment=uuid(fd.get("assignment_id"))
    const {data,error:lookup}=await client.from("task_assignments")
     .select("tasks(event_id,workplace_id)").eq("id",assignment).single()
    const task=data?.tasks
    if(lookup||!task?.event_id)throw Error("Event task not found")
    if(effectiveRole==="responsible_lead"){
     if(!task.workplace_id)throw Error("No responsible workplace")
     const {data:responsible,error:matchError}=await client.from("responsible_assignments")
      .select("workplace_id").eq("event_id",task.event_id)
      .eq("workplace_id",task.workplace_id).eq("user_id",actor.id).maybeSingle()
     if(matchError||!responsible)throw Error("Not assigned as responsible")
     const {data:allowed,error:featureError}=await client.rpc("upt_feature_allowed",{
      p_feature:"tasks",p_event:task.event_id,p_workplace:task.workplace_id
     })
     if(featureError||allowed!==true)throw Error("Task permission denied")
    }
    const {error}=await client.rpc("upt_remove_task_assignment",{
     p_assignment:assignment
    })
    if(error)throw Error("Task assignment removal failed")
    return done()
   }
   case "markAllNotificationsRead":{
    const cutoff=new Date().toISOString()
    // Original signed-user-only query, stable cutoff and fixed 50x5 batches.
    for(;;){
     const {data,error}=await client.from("crew_notifications").select("id")
      .eq("user_id",actor.id).is("read_at",null).lte("created_at",cutoff)
      .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50)
     if(error)throw Error("Notification query rejected")
     if(!data?.length)break
     for(let off=0;off<data.length;off+=5){
      const batchRows=data.slice(off,off+5)
      const results=await Promise.all(batchRows.map((row:{id:string})=>
       client.rpc("upt_mark_notification_read",{p_notification:uuid(row.id)})
      ))
      if(results.some((r:{error:unknown})=>Boolean(r.error)))throw Error("Notification read rejected")
     }
     if(data.length<50)break
    }
    return done()
   }
   case "updateEvent":{
    const start=date.parse(fd.get("start_at")),end=date.parse(fd.get("end_at"))
    if(Date.parse(end)<=Date.parse(start))throw Error("Invalid event times")
    const deadline=String(fd.get("registration_deadline")||"").trim()
    const deadlineDate=deadline?date.parse(deadline):start
    if(Date.parse(deadlineDate)>Date.parse(start))throw Error("Invalid registration deadline")
    const max=String(fd.get("max_joiners")||"").trim()
    const maxJoiners=max?z.coerce.number().int().min(1).max(10000).parse(max):null
    const {error}=await client.from("events").update({
     name:title.parse(fd.get("name")),...eventLocation(fd),
     start_at:start,end_at:end,start_date:start,end_date:end,
     registration_deadline:deadlineDate,max_joiners:maxJoiners,
     checkin_radius_m:z.coerce.number().int().min(10).max(10000).parse(fd.get("radius"))
    }).eq("id",uuid(fd.get("event_id")))
    if(error)throw Error("Event update rejected")
    return done()
   }
  }
  return failure(404,"unknown_action")
 }catch{return failure(422,"action_failed")}
}
