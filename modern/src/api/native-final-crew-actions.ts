// Final native action bundle — original crew briefings, personal instructions,
// assigned tasks, event documents and driver trips. The deployed Main QA Worker
// still blocks all writes; every entrypoint additionally verifies signed identity.
// Source of truth: lib/actions/uptilldawn.ts.
import {z} from "zod"
import {safeUploadName,validateUploadSecurity} from "../../../lib/upload-security.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,done,failure,type MegaDb,type AuthContext} from "./native-mega-helpers.ts"

export const finalCrewActionIds=[
 "lib/actions/uptilldawn.ts#createBriefing",
 "lib/actions/uptilldawn.ts#createPersonalInstruction",
 "lib/actions/uptilldawn.ts#updateBriefing",
 "lib/actions/uptilldawn.ts#updatePersonalInstruction",
 "lib/actions/uptilldawn.ts#createTask",
 "lib/actions/uptilldawn.ts#createEventDocument",
 "lib/actions/uptilldawn.ts#createPriceListDocument",
 "lib/actions/uptilldawn.ts#createDriverTransportTask",
] as const
export type FinalCrewActionId=typeof finalCrewActionIds[number]
const registered=new Set<string>(finalCrewActionIds)
export const finalCrewActionAllowed=(id:string|null):id is FinalCrewActionId=>
 typeof id==="string"&&registered.has(id)

const title=z.string().trim().min(1).max(200)
const longText=z.string().trim().min(1).max(20000)
const fileExtension:Record<string,string>={
 "image/jpeg":"jpg","image/png":"png","image/webp":"webp",
 "video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov",
 "application/pdf":"pdf","text/plain":"txt","text/csv":"csv",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
 "application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx"
}
function check(r:{error?:unknown}){if(r.error)throw Error("Source write rejected")}
function manager(a:AuthContext){
 const role=a.effective_role||a.role
 if(role!=="admin"&&role!=="responsible_lead")throw Error("Manager required")
 return role
}
async function eventManager(db:MegaDb,a:AuthContext,eventId:string){
 const role=manager(a)
 if(role==="admin")return
 const {data,error}=await db.from("event_members").select("event_id")
  .eq("event_id",eventId).eq("user_id",a.id)
  .in("event_role",["responsible_lead","admin"]).maybeSingle()
 if(error||!data)throw Error("Manager not assigned to event")
}
async function feature(db:MegaDb,a:AuthContext,name:string,event:string,workplace:string|null){
 if(manager(a)==="admin")return
 const {data,error}=await db.rpc("upt_feature_allowed",{
  p_feature:name,p_event:event,p_workplace:workplace||undefined
 })
 if(error||data!==true)throw Error("Feature unavailable")
}
async function workplaceEvent(fd:FormData,db:MegaDb,checkActive=false){
 const raw=String(fd.get("workplace_id")||"").trim()
 const workplace=raw?uuid(raw):null
 if(!workplace)return {event:uuid(fd.get("event_id")),workplace}
 const {data,error}=await db.from("workplaces").select("event_id,is_active").eq("id",workplace).single()
 if(error||!data||checkActive&&!data.is_active)throw Error("Workplace unavailable")
 return {event:uuid(data.event_id),workplace}
}
async function attachments(fd:FormData){
 const files=[...fd.getAll("photos"),fd.get("briefing_document")]
  .filter((v):v is File=>v instanceof File&&v.size>0)
 if(files.length>6)throw Error("Maximum six attachments")
 for(const file of files){
  await validateUploadSecurity(file)
  if(!fileExtension[file.type])throw Error("Unsupported attachment")
 }
 return files
}
type WorkTarget={type:"briefing"|"instruction"|"task";id:string}
async function cleanup(db:MegaDb,paths:string[]){
 if(!paths.length)return
 await db.from("work_attachments").delete().in("storage_path",paths)
 await db.storage.from("work-media").remove(paths)
}
async function uploadWorkFiles(db:MegaDb,user:string,target:WorkTarget,files:File[]){
 if(!files.length)return [] as string[]
 const key=target.type==="briefing"?"briefing_id":target.type==="instruction"?"personal_instruction_id":"task_id"
 const {count,error}=await db.from("work_attachments").select("id",{count:"exact",head:true}).eq(key,target.id)
 if(error||(count??0)+files.length>10)throw Error("Attachment capacity exceeded")
 const uploaded:string[]=[]
 try{
  for(const file of files){
   const path=user+"/"+target.type+"/"+target.id+"/"+crypto.randomUUID()+"."+fileExtension[file.type]
   check(await db.storage.from("work-media").upload(path,file,{contentType:file.type,upsert:false}))
   uploaded.push(path)
   const {error:linkError}=await db.from("work_attachments").insert({
    [key]:target.id,storage_path:path,mime_type:file.type,uploaded_by:user
   })
   if(linkError)throw Error("Attachment metadata rejected")
  }
  return uploaded
 }catch(e){await cleanup(db,uploaded);throw e}
}
async function briefing(fd:FormData,db:MegaDb,a:AuthContext,action:string){
 const personal=action.includes("PersonalInstruction")
 const create=action.startsWith("create")
 const table=personal?"personal_instructions":"briefings"
 const files=await attachments(fd)
 let event:string,workplace:string|null,id:string|undefined
 if(create){
  const scope=await workplaceEvent(fd,db)
  event=scope.event;workplace=scope.workplace
 }else{
  id=uuid(fd.get("id"))
  const {data,error}=await db.from(table).select("event_id,workplace_id").eq("id",id).single()
  if(error||!data)throw Error("Instruction not found")
  event=uuid(data.event_id);workplace=data.workplace_id?uuid(data.workplace_id):null
 }
 await eventManager(db,a,event)
 await feature(db,a,"briefings",event,workplace)
 let target:string|undefined
 if(create&&personal){
  target=uuid(fd.get("user_id"))
  const {data,error}=await db.from("event_members").select("user_id")
   .eq("event_id",event).eq("user_id",target).maybeSingle()
  if(error||!data)throw Error("Instruction recipient is not an event member")
 }
 const changes={title:title.parse(fd.get("title")),body:longText.parse(fd.get("body"))}
 if(create){
  const {data,error}=await db.from(table).insert({
   event_id:event,workplace_id:workplace,...changes,created_by:a.id,
   ...(personal?{user_id:target}:{})
  }).select("id").single()
  if(error||!data)throw Error("Instruction insertion failed")
  id=uuid(data.id)
  try{await uploadWorkFiles(db,a.id,{type:personal?"instruction":"briefing",id},files)}
  catch(e){await db.from(table).delete().eq("id",id);throw e}
 }else{
  const paths=await uploadWorkFiles(db,a.id,{type:personal?"instruction":"briefing",id:id!},files)
  const {error}=await db.from(table).update(changes).eq("id",id)
  if(error){await cleanup(db,paths);throw Error("Instruction update failed")}
 }
}
async function task(fd:FormData,db:MegaDb,a:AuthContext){
 const files=await attachments(fd)
 const {event,workplace}=await workplaceEvent(fd,db,true)
 if(manager(a)==="responsible_lead"){
  if(!workplace)throw Error("Responsible workplace required")
  const {data,error}=await db.from("responsible_assignments").select("workplace_id")
   .eq("event_id",event).eq("workplace_id",workplace).eq("user_id",a.id).maybeSingle()
  if(error||!data)throw Error("Responsible assignment required")
 }else await eventManager(db,a,event)
 await feature(db,a,"tasks",event,workplace)
 const users=[...new Set(fd.getAll("user_id").map(uuid))]
 if(!users.length||users.length>100)throw Error("Invalid task recipients")
 const [members,available]=await Promise.all([
  db.from("event_members").select("user_id").eq("event_id",event).in("user_id",users),
  db.from("event_availability").select("user_id").eq("event_id",event).eq("response","can").in("user_id",users)
 ])
 if(members.error||available.error)throw Error("Membership lookup failed")
 const memberIds=new Set((members.data||[]).map((r:{user_id:string})=>r.user_id))
 const availableIds=new Set((available.data||[]).map((r:{user_id:string})=>r.user_id))
 if(users.some(id=>!memberIds.has(id)||!availableIds.has(id)))throw Error("Unavailable task recipient")
 if(manager(a)==="responsible_lead"){
  const {data,error}=await db.from("shifts").select("user_id").eq("event_id",event)
   .eq("workplace_id",workplace).neq("status","cancelled").in("user_id",users)
  const shiftIds=new Set((data||[]).map((r:{user_id:string})=>r.user_id))
  if(error||users.some(id=>!shiftIds.has(id)))throw Error("Recipient outside workplace")
 }
 const [first,...others]=users
 const {data:taskId,error}=await db.rpc("upt_create_assigned_task",{
  p_event:event,p_workplace:workplace,p_user:first,
  p_title:title.parse(fd.get("title")),
  p_description:String(fd.get("description")||"").slice(0,4000)
 })
 if(error||!taskId)throw Error("Task creation failed")
 const id=uuid(taskId)
 try{
  for(const user of others)check(await db.rpc("upt_assign_task",{p_task:id,p_user:user}))
  await uploadWorkFiles(db,a.id,{type:"task",id},files)
 }catch(e){await db.from("tasks").delete().eq("id",id);throw e}
}
async function document(fd:FormData,db:MegaDb,a:AuthContext,priceList:boolean){
 manager(a)
 if(priceList){
  const name=title.parse(fd.get("workplace_name"))
  fd.set("kind","technical")
  fd.set("audience","employee")
  fd.set("title","Prijslijst · "+name)
  fd.set("description","Actuele prijslijst voor "+name+".")
  fd.set("offline_critical","on")
 }
 const file=fd.get("document")
 if(!(file instanceof File)||file.size===0)throw Error("Document required")
 const validated=await validateUploadSecurity(file)
 const extension=fileExtension[validated.mime]
 if(!extension||validated.kind==="video")throw Error("Invalid document type")
 const event=uuid(fd.get("event_id"))
 const raw=String(fd.get("workplace_id")||"").trim()
 const workplace=raw?uuid(raw):null
 if(manager(a)==="responsible_lead"&&!workplace)throw Error("Assigned workplace required")
 // This RPC enforces the authoritative event, workplace and role scope.
 const path=a.id+"/document/"+crypto.randomUUID()+"."+extension
 check(await db.storage.from("work-media").upload(path,file,{contentType:file.type,upsert:false}))
 try{
  check(await db.rpc("upt_create_event_document",{
   p_event:event,p_workplace:workplace,
   p_kind:z.enum(["briefing","safety","map","procedure","permit","technical","crew"]).parse(fd.get("kind")),
   p_audience:z.enum(["employee","responsible","admin"]).parse(fd.get("audience")),
   p_title:title.parse(fd.get("title")),
   p_description:String(fd.get("description")||"").trim().slice(0,2000),
   p_storage_path:path,p_file_name:safeUploadName(file.name),
   p_mime_type:file.type,p_file_size_bytes:file.size,
   p_offline_critical:fd.get("offline_critical")==="on"
  }))
 }catch(e){await db.storage.from("work-media").remove([path]);throw e}
}
async function geoapify(key:string,path:string,params:URLSearchParams){
 if(!key)throw Error("Geoapify unavailable")
 params.set("apiKey",key)
 const response=await fetch("https://api.geoapify.com/v1/"+path+"?"+params,{
  headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000)
 })
 if(!response.ok)throw Error("Online route unavailable")
 return response.json() as Promise<any>
}
async function geoPoint(key:string,address:string){
 const query=new URLSearchParams({text:address,format:"json",limit:"1",lang:"nl"})
 const data=await geoapify(key,"geocode/search",query)
 const row=data.results?.[0]
 if(!Number.isFinite(row?.lat)||!Number.isFinite(row?.lon))throw Error("Invalid online location")
 return {latitude:row.lat as number,longitude:row.lon as number}
}
async function routeEstimate(key:string,from:{latitude:number;longitude:number},to:{latitude:number;longitude:number}){
 const query=new URLSearchParams({waypoints:from.latitude+","+from.longitude+"|"+to.latitude+","+to.longitude,mode:"drive"})
 const data=await geoapify(key,"routing",query)
 const props=data.features?.[0]?.properties
 if(!Number.isFinite(props?.time)||props.time<0)throw Error("No route estimate")
 const dist=Number.isFinite(props.distance)?props.distance:0
 return {minutes:Math.max(1,Math.ceil(props.time/60)),kilometers:Math.max(0,Math.round(dist/10)/100)}
}
async function driver(fd:FormData,db:MegaDb,a:AuthContext,geoKey:string){
 if(!await approvedAdmin(db,a))throw Error("Admin privilege required")
 const shiftId=uuid(fd.get("shift_id"))
 const direction=z.enum(["pickup","dropoff"]).parse(fd.get("direction"))
 const passenger=title.parse(fd.get("passenger_name"))
 const phone=title.parse(fd.get("passenger_phone"))
 const address=title.parse(fd.get("address"))
 const guest=String(fd.get("guestlist_entry_id")||"").trim()
 const scheduled=new Date(String(fd.get("scheduled_at")||""))
 if(!Number.isFinite(scheduled.getTime()))throw Error("Invalid trip date")
 const {data:shift,error}=await db.from("shifts")
  .select("id,event_id,workplace_id,user_id,status,workplaces(name),events(address,latitude,longitude)")
  .eq("id",shiftId).single()
 if(error||!shift||shift.status==="cancelled"||!/driver/i.test(shift.workplaces?.name||"")||!shift.events)
  throw Error("Valid Driver shift required")
 let minutes:number,kilometers:number
 if(fd.get("use_online_route")==="on"){
  const ev=shift.events
  const start=ev.latitude!=null&&ev.longitude!=null
   ?{latitude:Number(ev.latitude),longitude:Number(ev.longitude)}
   :await geoPoint(geoKey,String(ev.address||""))
  const end=await geoPoint(geoKey,address)
  const route=await routeEstimate(geoKey,start,end)
  minutes=route.minutes;kilometers=route.kilometers
 }else{
  const m=String(fd.get("manual_travel_minutes")??"").trim()
  const k=String(fd.get("manual_route_km")??"").trim()
  if(!/^[1-9][0-9]{0,3}$/.test(m)||!/^(?:0|[1-9][0-9]{0,3})(?:\.[0-9]{1,2})?$/.test(k))
   throw Error("Invalid manual route")
  minutes=Number(m);kilometers=Number(k)
  if(minutes>1440||kilometers<=0||kilometers>2000)throw Error("Route outside source limits")
 }
 const notify=new Date(scheduled.getTime()-(minutes+15)*60000).toISOString()
 const taskTitle=(direction==="pickup"?"Ophalen · ":"Afzetten · ")+passenger
 const description=phone+" · "+address+" · "+scheduled.toLocaleString("nl-BE")
 const {data:created,error:insertError}=await db.rpc("upt_create_assigned_task",{
  p_event:shift.event_id,p_workplace:shift.workplace_id,p_user:shift.user_id,
  p_title:taskTitle,p_description:description
 })
 if(insertError||!created)throw Error("Driver task creation failed")
 const id=uuid(created)
 try{check(await db.rpc("upt_set_driver_task_details",{
  p_task:id,p_direction:direction,p_passenger_name:passenger,p_passenger_phone:phone,
  p_address:address,p_scheduled_at:scheduled.toISOString(),
  p_estimated_drive_minutes:minutes,p_notify_at:notify,p_expected_km:kilometers,
  p_guestlist_entry:guest?uuid(guest):null
 }))}catch(e){await db.from("tasks").delete().eq("id",id);throw e}
}
export async function finalCrewActionResponse(
 req:Request,db:NativeAdminActionDb,selected:FinalCrewActionId,
 geoKey=""
):Promise<Response>{
 const name=selected.split("#")[1]
 const upload=name==="createEventDocument"||name==="createPriceListDocument"
 const photos=name.includes("Briefing")||name.includes("PersonalInstruction")||name==="createTask"
 const size=photos?64*1024*1024:upload?22*1024*1024:64*1024
 const parsed=await parseMegaRequest(req,db,selected,0,size)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 try{
  switch(name){
   case "createBriefing":case "createPersonalInstruction":
   case "updateBriefing":case "updatePersonalInstruction":
    await briefing(fd,client,actor,name);break
   case "createTask":await task(fd,client,actor);break
   case "createEventDocument":await document(fd,client,actor,false);break
   case "createPriceListDocument":await document(fd,client,actor,true);break
   case "createDriverTransportTask":await driver(fd,client,actor,geoKey);break
   default:return failure(404,"unknown_action")
  }
  return done()
 }catch{return failure(422,"action_failed")}
}
