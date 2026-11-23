// Sixth disabled Main-QA action wave: original catalog maintenance, event
// templates, event duplication/archive aliases and checklist creation.
// The original Next UI and production remain unchanged; Hono writes stay OFF.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export const nativeCatalogAdminActionIds=[
 "lib/actions/workplace-catalog.ts#createCatalogWorkplace",
 "lib/actions/workplace-catalog.ts#updateCatalogWorkplace",
 "lib/actions/workplace-catalog.ts#createCatalogItem",
 "lib/actions/workplace-catalog.ts#updateCatalogItem",
 "lib/actions/events.ts#captureEventTemplate",
 "lib/actions/events.ts#applyEventTemplate",
 "lib/actions/uptilldawn.ts#duplicateEvent",
 "lib/actions/uptilldawn.ts#archiveEvent",
 "lib/actions/uptilldawn.ts#deleteEvent",
] as const
export const nativeCatalogManagerActionIds=[
 "lib/actions/uptilldawn.ts#createOperationalChecklist",
] as const
export const nativeCatalogActionIds=[...nativeCatalogAdminActionIds,...nativeCatalogManagerActionIds] as const
export type NativeCatalogActionId=typeof nativeCatalogActionIds[number]
const ids=new Set<string>(nativeCatalogActionIds)
const adminIds=new Set<string>(nativeCatalogAdminActionIds)
export const nativeCatalogActionAllowed=(id:string|null):id is NativeCatalogActionId=>
 typeof id==="string"&&ids.has(id)

const uuid=z.string().uuid()
const title=z.string().trim().min(1).max(200)
const nonnegative=z.coerce.number().int().min(0).max(10000)
const stock=z.coerce.number().int().min(0).max(100000)
const date=z.string().datetime({offset:true})
const sections=["workplaces","briefing","tasks","checklists","inventory"] as const
type Command={rpc:string;args:Record<string,unknown>;post?:"sync-future"|"sync-created"|"read-workplace"}
const noStore={"Cache-Control":"private, no-store"}
const fail=(status:number,code:string)=>Response.json({
 error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code
},{status,headers:noStore})

function capacity(fd:FormData){
 const minimum=nonnegative.parse(fd.get("minimum_staff")||0)
 const target=nonnegative.parse(fd.get("target_staff")||0)
 const maxRaw=String(fd.get("maximum_staff")||"").trim()
 const maximum=maxRaw?nonnegative.parse(maxRaw):undefined
 if(minimum>target||(maximum!==undefined&&target>maximum))
  throw Error("Invalid workplace capacity")
 return {
  p_minimum_staff:minimum,p_target_staff:target,p_maximum_staff:maximum
 }
}
function span(fd:FormData){
 const start=date.parse(fd.get("start_at"))
 const end=date.parse(fd.get("end_at"))
 if(Date.parse(end)<=Date.parse(start))throw Error("End must follow start")
 return {p_start:start,p_end:end}
}
const optional=(fd:FormData,key:string,max:number)=>
 String(fd.get(key)||"").trim().slice(0,max)||undefined
export function originalCatalogCommand(id:NativeCatalogActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/workplace-catalog.ts#createCatalogWorkplace":
   return {rpc:"upt_create_workplace_catalog",post:"sync-future",args:{
    p_name:title.parse(fd.get("name")),
    p_description:optional(fd,"description",1000),
    p_sort_order:nonnegative.parse(fd.get("sort_order")||0),
    ...capacity(fd)
   }}
  case "lib/actions/workplace-catalog.ts#updateCatalogWorkplace":
   return {rpc:"upt_update_workplace_catalog",post:"sync-future",args:{
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_name:title.parse(fd.get("name")),
    p_description:optional(fd,"description",1000),
    p_sort_order:nonnegative.parse(fd.get("sort_order")||0),
    ...capacity(fd),
    p_is_active:fd.get("is_active")==="on"
   }}
  case "lib/actions/workplace-catalog.ts#createCatalogItem":
   return {rpc:"upt_create_workplace_catalog_item",post:"sync-future",args:{
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_name:title.parse(fd.get("name")),
    p_category:optional(fd,"category",120),
    p_quantity:stock.parse(fd.get("quantity")||0)
   }}
  case "lib/actions/workplace-catalog.ts#updateCatalogItem":
   return {rpc:"upt_update_workplace_catalog_item",post:"sync-future",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_name:title.parse(fd.get("name")),
    p_category:optional(fd,"category",120),
    p_quantity:stock.parse(fd.get("quantity")||0),
    p_is_active:fd.get("is_active")==="on"
   }}
  case "lib/actions/events.ts#captureEventTemplate":{
   const selected=sections.filter(section=>fd.get("section_"+section)==="on")
   if(!selected.length)throw Error("At least one template section is required")
   return {rpc:"upt_capture_event_template",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_name:title.parse(fd.get("template_name")),
    p_sections:selected
   }}
  }
  case "lib/actions/events.ts#applyEventTemplate":
   return {rpc:"upt_apply_event_template_v2",post:"sync-created",args:{
    p_template:uuid.parse(fd.get("template_id")),
    p_name:title.parse(fd.get("name")),
    ...span(fd),
    p_venue:optional(fd,"venue",200),
    p_address:optional(fd,"address",500)
   }}
  case "lib/actions/uptilldawn.ts#duplicateEvent":
   return {rpc:"upt_duplicate_event",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_name:title.parse(fd.get("name")),
    ...span(fd)
   }}
  case "lib/actions/uptilldawn.ts#archiveEvent":
  case "lib/actions/uptilldawn.ts#deleteEvent":
   return {rpc:"upt_archive_event",args:{p_event:uuid.parse(fd.get("event_id"))}}
  case "lib/actions/uptilldawn.ts#createOperationalChecklist":
   return {rpc:"upt_create_operational_checklist",post:"read-workplace",args:{
    // The original action resolves p_event from the workplace; NEVER accept
    // an untrusted browser-supplied event_id for this foreign key.
    p_event:undefined,
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_kind:z.enum(["opening","closing","safety","custom"]).parse(fd.get("kind")),
    p_title:title.parse(fd.get("title")),
    p_description:String(fd.get("description")||"").trim().slice(0,2000)
   }}
 }
}
type DatabaseResult<T>={data:T|null;error:unknown}
type FutureQuery={
 select:(columns:string)=>{neq:(field:string,value:string)=>{
  gte:(field:string,value:string)=>Promise<DatabaseResult<Array<{id:string}>>>
 }}
}
type WorkplaceQuery={
 select:(columns:string)=>{eq:(field:string,value:string)=>{
  single:()=>Promise<DatabaseResult<{event_id:string}>>
 }}
}
// Use the same signed Supabase client passed by sourceReadSession; no
// browser service-role secret, and no new SQL endpoints/tables.
async function syncFutureEvents(db:NativeAdminActionDb){
 const source=db as unknown as {from:(table:string)=>FutureQuery}
 const {data}=await source.from("events").select("id").neq("status","archived")
  .gte("end_at",new Date().toISOString())
 // Original source intentionally ignores errors in individual follow-up syncs.
 for(const event of data||[]){
  await db.rpc("upt_sync_workplace_catalog_to_event",{p_event:event.id})
 }
}
async function workplaceEvent(db:NativeAdminActionDb,workplaceId:string){
 const source=db as unknown as {from:(table:string)=>WorkplaceQuery}
 const {data,error}=await source.from("workplaces").select("event_id")
  .eq("id",workplaceId).single()
 if(error||!data)throw Error("Workplace not found")
 return uuid.parse(data.event_id)
}
export async function nativeCatalogActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeCatalogActionId
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
 const raw=body.get("_args")
 if(typeof raw!=="string"||raw.length>1024*1024)
  return fail(413,"invalid_arguments")
 let args:unknown
 try{args=decode(JSON.parse(raw),body)}
 catch{return fail(400,"invalid_arguments")}
 if(!Array.isArray(args)||args.length!==1||!(args[0] instanceof FormData))
  return fail(400,"invalid_arguments")
 try{
  const {data:{user},error:authError}=await db.auth.getUser()
  if(authError||!user)return fail(401,"authentication_required")
  if(adminIds.has(selected)){
   const {data:approved,error:approvedError}=await db.rpc("upt_is_approved")
   if(approvedError||approved!==true)return fail(422,"action_failed")
   const {data:isAdmin,error:adminError}=await db.rpc("upt_is_admin",{uid:user.id})
   if(adminError||isAdmin!==true)return fail(422,"action_failed")
  }else{
   const {data:rows,error:profileError}=await db.rpc("upt_current_profile")
   const profile=Array.isArray(rows)?rows[0]:null
   if(profileError||profile?.approved!==true||profile?.account_blocked===true)
    return fail(422,"action_failed")
   const {data:role,error:roleError}=await db.rpc("upt_current_effective_role")
   if(roleError||!["admin","responsible_lead"].includes(
    typeof role==="string"&&role?role:String(profile.role||"")
   ))return fail(422,"action_failed")
  }
  const command=originalCatalogCommand(selected,args[0])
  if(command.post==="read-workplace")
   command.args.p_event=await workplaceEvent(db,command.args.p_workplace as string)
  const {data,error}=await db.rpc(command.rpc,command.args)
  if(error)return fail(422,"action_failed")
  if(command.post==="sync-created"){
   if(!data)return fail(422,"action_failed")
   // Same original post-template catalog update; source ignores its error.
   await db.rpc("upt_sync_workplace_catalog_to_event",{p_event:data})
  }else if(command.post==="sync-future")await syncFutureEvents(db)
  return Response.json({value:encode(undefined,new FormData()),refresh:true},{headers:noStore})
 }catch{return fail(422,"action_failed")}
}
