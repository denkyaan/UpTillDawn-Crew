// Eighth source-exact original action wave: event creation, safe staffing,
// responsible coverage and lifecycle state. Same screens; QA writes disabled.
import {z} from "zod"
import {fetchFacebookEventInfo} from "../../../lib/facebook-event.ts"
import {responsibleHasConflict} from "../../../lib/responsible-coverage.ts"
import {workplaceCapacityIsValid} from "../../../lib/workplace-capacity.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {approvedAdmin,parseMegaRequest,uuid,option,done,failure} from "./native-mega-helpers.ts"

export const megaCrewEventActionIds=[
 "lib/actions/events.ts#createEvent",
 "lib/actions/events.ts#archiveEventWithState",
 "lib/actions/events.ts#restoreEventWithState",
 "lib/actions/uptilldawn.ts#createEvent",
 "lib/actions/uptilldawn.ts#addWorkplace",
 "lib/actions/uptilldawn.ts#updateWorkplace",
 "lib/actions/uptilldawn.ts#addEventMember",
 "lib/actions/uptilldawn.ts#addAvailableEventMembers",
 "lib/actions/uptilldawn.ts#assignAvailableCrewShift",
 "lib/actions/uptilldawn.ts#assignResponsible",
 "lib/actions/uptilldawn.ts#demoteResponsibleToStaff",
] as const
export type MegaCrewEventId=typeof megaCrewEventActionIds[number]
const ids=new Set<string>(megaCrewEventActionIds)
export const megaCrewEventAllowed=(id:string|null):id is MegaCrewEventId=>typeof id==="string"&&ids.has(id)
const title=z.string().trim().min(1).max(200)
const datetime=z.string().datetime({offset:true})
const num=(max=10000)=>z.coerce.number().int().min(0).max(max)
const fail=(msg="action_failed")=>failure(422,msg)
const requireValid=(result:{error:unknown})=>{if(result.error)throw Error("Original database write rejected")}
function dates(fd:FormData,from:string,to:string){
 const start=datetime.parse(fd.get(from)),end=datetime.parse(fd.get(to))
 if(Date.parse(end)<=Date.parse(start))throw Error("End must follow start")
 return [start,end] as const
}
function location(fd:FormData,override?:{venue?:string|null;address?:string|null}){
 const venue=String(override?.venue??fd.get("venue")??"").trim().slice(0,200)
 const address=String(override?.address??fd.get("address")??"").trim().slice(0,500)
 const latRaw=override?.address||override?.venue?"":String(fd.get("latitude")||"").trim()
 const lonRaw=override?.address||override?.venue?"":String(fd.get("longitude")||"").trim()
 const latitude=latRaw?z.coerce.number().min(-90).max(90).parse(latRaw):null
 const longitude=lonRaw?z.coerce.number().min(-180).max(180).parse(lonRaw):null
 if((latitude===null)!==(longitude===null))throw Error("Invalid geographic location")
 return {venue,address,latitude,longitude}
}
function capacities(fd:FormData){
 const minimumStaff=num().parse(fd.get("minimum_staff")||0)
 const targetStaff=num().parse(fd.get("target_staff")||0)
 const maxRaw=String(fd.get("maximum_staff")||"").trim()
 const maximumStaff=maxRaw?num().parse(maxRaw):null
 if(!workplaceCapacityIsValid({workplaceId:"form",
   minimumStaff,targetStaff,maximumStaff}))throw Error("Invalid capacity")
 return {minimum_staff:minimumStaff,target_staff:targetStaff,maximum_staff:maximumStaff}
}
function memberRole(role:string){
 return role==="responsible_lead"?"responsible_lead":role==="admin"?"admin":"employee"
}
async function makeEvent(fd:FormData,db:any,actor:string,variant:"events"|"uptilldawn"){
 const fb=String(fd.get("facebook_event_url")||"").trim()
 const imported=fb?await fetchFacebookEventInfo(fb):null
 const name=title.parse(imported?.name||String(fd.get("name")||"").trim())
 const start=imported?.startAt||(String(fd.get("start_at")||"").trim()?
  datetime.parse(fd.get("start_at")):null)
 const end=imported?.endAt||(String(fd.get("end_at")||"").trim()?
  datetime.parse(fd.get("end_at")):null)
 if(!start||!end||Date.parse(end)<=Date.parse(start))throw Error("Invalid event time")
 const place=location(fd,{venue:imported?.venue||undefined,address:imported?.address||undefined})
 const row:Record<string,unknown>={
  name,...place,start_at:start,end_at:end,start_date:start,end_date:end,
  facebook_event_url:fb?(imported?.sourceUrl||fb):null,
  checkin_radius_m:z.coerce.number().int().min(10).max(10000).parse(fd.get("radius")||100),
  created_by:actor
 }
 if(variant==="events")row.image_url=imported?.imageUrl||null
 else{
  const reg=String(fd.get("registration_deadline")||"").trim()
  row.registration_deadline=reg?datetime.parse(reg):start
  if(Date.parse(row.registration_deadline as string)>Date.parse(start))throw Error("Registration cutoff after start")
  const capacity=String(fd.get("max_joiners")||"").trim()
  row.max_joiners=capacity?num().min(1).parse(capacity):null
 }
 if(variant==="events"){
  const {data,error}=await db.from("events").insert(row).select("id").single()
  if(error||!data)throw Error("Event insertion failed")
  // Source logs but ignores failed catalog initialization.
  await db.rpc("upt_sync_workplace_catalog_to_event",{p_event:uuid(data.id)})
 }else requireValid(await db.from("events").insert(row))
}
async function addMember(fd:FormData,db:any,bulk:boolean){
 const event=uuid(fd.get("event_id"))
 const ids=[...new Set((bulk?fd.getAll("user_id"):[fd.get("user_id")]).map(uuid))]
 if(!ids.length)throw Error("No staff selected")
 if(!bulk){
  const target=ids[0]
  const [{data:p,error:profileError},{data:a,error:availabilityError}]=await Promise.all([
   db.rpc("upt_admin_profiles").select("approved,role").eq("id",target).single(),
   db.from("event_availability").select("response").eq("event_id",event)
    .eq("user_id",target).maybeSingle()
  ])
  if(profileError||availabilityError||!p?.approved||a?.response!=="can")
   throw Error("Staff not available")
  requireValid(await db.from("event_members").upsert({
   event_id:event,user_id:target,event_role:memberRole(p.role)
  },{onConflict:"event_id,user_id"}))
 }else{
  const [{data:available,error:avError},{data:approved,error:pError}]=await Promise.all([
   db.from("event_availability").select("user_id").eq("event_id",event)
    .eq("response","can").in("user_id",ids),
   db.rpc("upt_admin_profiles").select("id,role").eq("approved",true).in("id",ids)
  ])
  if(avError||pError)throw Error("Availability lookup failed")
  const allowed=new Set((available||[]).map((row:{user_id:string})=>row.user_id))
  const roles=new Map((approved||[]).map((row:{id:string;role:string})=>[row.id,row.role]))
  if(ids.some(id=>!allowed.has(id)||!roles.has(id)))throw Error("Staff selection stale")
  requireValid(await db.from("event_members").upsert(ids.map(user_id=>({
   event_id:event,user_id,event_role:memberRole(roles.get(user_id) as string)
  })),{onConflict:"event_id,user_id"}))
 }
}
async function assignCrewShift(fd:FormData,db:any){
 const event=uuid(fd.get("event_id")),target=uuid(fd.get("user_id"))
 const workplace=uuid(fd.get("workplace_id"))
 const [start,end]=dates(fd,"start","end")
 const kind=z.enum(["event","setup","breakdown"]).parse(fd.get("shift_kind")||"event")
 const [profile,availability,post,membership]=await Promise.all([
  db.rpc("upt_admin_profiles").select("id,approved,role").eq("id",target).single(),
  db.from("event_availability").select("response,setup_available,breakdown_available")
   .eq("event_id",event).eq("user_id",target).maybeSingle(),
  db.from("workplaces").select("id,event_id,is_active").eq("id",workplace).single(),
  db.from("event_members").select("user_id").eq("event_id",event)
   .eq("user_id",target).maybeSingle()
 ])
 if([profile,availability,post,membership].some(x=>x.error))throw Error("Membership lookup failed")
 const p=profile.data,a=availability.data,w=post.data
 if(!p?.approved||!(kind==="event"?a?.response==="can":
  kind==="setup"?a?.setup_available===true:a?.breakdown_available===true))
  throw Error("Person unavailable")
 if(!w?.is_active||w.event_id!==event)throw Error("Wrong workplace")
 let createdRole:string|null=null
 if(!membership.data){
  const eventRole=memberRole(p.role)
  requireValid(await db.from("event_members").insert({
   event_id:event,user_id:target,event_role:eventRole
  }))
  createdRole=eventRole
 }
 const {error}=await db.rpc("upt_create_shift",{
  p_workplace:workplace,p_user:target,p_role_name:title.parse(fd.get("role_name")||"Personeel"),
  p_start:start,p_end:end,p_overlap_allowed:fd.get("overlap_allowed")==="on",p_shift_kind:kind
 })
 if(error){
  if(createdRole)await db.from("event_members").delete().eq("event_id",event)
   .eq("user_id",target).eq("event_role",createdRole)
  throw Error("Shift creation failed")
 }
}
async function assignResponsible(fd:FormData,db:any,actor:string){
 const workplace=uuid(fd.get("workplace_id")),target=uuid(fd.get("user_id"))
 const [profile,post,assigned,all,assignments]=await Promise.all([
  db.rpc("upt_admin_profiles").select("approved,role").eq("id",target).single(),
  db.from("workplaces").select("event_id,is_active").eq("id",workplace).single(),
  db.from("shifts").select("workplace_id,scheduled_start,scheduled_end")
   .eq("workplace_id",workplace).eq("user_id",target)
   .neq("status","cancelled").neq("response_status","declined"),
  db.from("shifts").select("workplace_id,scheduled_start,scheduled_end")
   .eq("user_id",target).neq("status","cancelled").neq("response_status","declined"),
  db.from("responsible_assignments").select("workplace_id").eq("user_id",target)
 ])
 if([profile,post,assigned,all,assignments].some(x=>x.error))throw Error("Responsibility lookup failed")
 if(!post.data?.is_active||!profile.data?.approved||!assigned.data?.length)
  throw Error("Responsible assignment ineligible")
 const others=new Set((assignments.data||[]).map((row:{workplace_id:string})=>row.workplace_id)
  .filter((id:string)=>id!==workplace))
 const existing=(all.data||[]).filter((row:{workplace_id:string})=>others.has(row.workplace_id))
  .map((row:{workplace_id:string;scheduled_start:string;scheduled_end:string})=>({
   userId:target,workplaceId:row.workplace_id,
   startsAt:Date.parse(row.scheduled_start),endsAt:Date.parse(row.scheduled_end)
  }))
 for(const row of assigned.data){
  if(responsibleHasConflict({
   userId:target,workplaceId:workplace,
   startsAt:Date.parse(row.scheduled_start),endsAt:Date.parse(row.scheduled_end)
  },existing))throw Error("Overlapping responsible duties")
 }
 if(profile.data.role==="staff")requireValid(await db.rpc("upt_admin_set_account",{
  p_user:target,p_approved:true,p_role:"responsible_lead"
 }))
 requireValid(await db.from("event_members").upsert({
  event_id:post.data.event_id,user_id:target,
  event_role:profile.data.role==="admin"?"admin":"responsible_lead"
 },{onConflict:"event_id,user_id"}))
 requireValid(await db.from("responsible_assignments").upsert({
  event_id:post.data.event_id,workplace_id:workplace,user_id:target,assigned_by:actor
 },{onConflict:"workplace_id,user_id"}))
}
async function demoteResponsible(fd:FormData,db:any){
 const workplace=uuid(fd.get("workplace_id")),target=uuid(fd.get("user_id"))
 const [post,profile,assignment]=await Promise.all([
  db.from("workplaces").select("event_id").eq("id",workplace).single(),
  db.rpc("upt_admin_profiles").select("role,approved").eq("id",target).single(),
  db.from("responsible_assignments").select("event_id,workplace_id,user_id")
   .eq("workplace_id",workplace).eq("user_id",target).maybeSingle()
 ])
 if([post,profile,assignment].some(x=>x.error)||!post.data||!assignment.data||
    profile.data?.role==="admin")throw Error("Responsibility not available")
 requireValid(await db.from("responsible_assignments").delete()
  .eq("workplace_id",workplace).eq("user_id",target))
 const [events,remaining]=await Promise.all([
  db.from("responsible_assignments").select("workplace_id")
   .eq("event_id",post.data.event_id).eq("user_id",target).limit(1),
  db.from("responsible_assignments").select("workplace_id").eq("user_id",target).limit(1)
 ])
 if(events.error||remaining.error)throw Error("Remaining duties lookup failed")
 if(!events.data?.length)requireValid(await db.from("event_members")
  .update({event_role:"employee"}).eq("event_id",post.data.event_id)
  .eq("user_id",target).eq("event_role","responsible_lead"))
 if(profile.data?.role==="responsible_lead"&&!remaining.data?.length){
  requireValid(await db.rpc("upt_admin_set_account",{
   p_user:target,p_approved:profile.data.approved===true,p_role:"staff"
  }))
  requireValid(await db.from("event_members").update({event_role:"employee"})
   .eq("user_id",target).eq("event_role","responsible_lead"))
 }
}
export async function megaCrewEventResponse(
 req:Request,db:NativeAdminActionDb,selected:MegaCrewEventId
):Promise<Response>{
 const state=selected.endsWith("WithState")?1:0
 const parsed=await parseMegaRequest(req,db,selected,state as 0|1)
 if(!parsed.ok)return parsed.response
 const {fd,db:client,actor}=parsed
 if(!await approvedAdmin(client,actor))return fail()
 const action=selected.split("#")[1]
 try{
  switch(action){
   case "createEvent":await makeEvent(fd,client,actor.id,
    selected.startsWith("lib/actions/events.ts")?"events":"uptilldawn");break
   case "archiveEventWithState":
   case "restoreEventWithState":{
    const event=uuid(fd.get("event_id"))
    const reason=String(fd.get("reason")||"").trim()
    const command=action==="restoreEventWithState"?
     {rpc:"upt_restore_event",args:{p_event:event,p_reason:reason||undefined}}:
     fd.get("force")==="on"?
      {rpc:"upt_force_archive_event",args:{p_event:event,p_reason:reason}}:
      {rpc:"upt_archive_event",args:{p_event:event}}
    const {error}=await client.rpc(command.rpc,command.args)
    return done({error:error?
     action==="restoreEventWithState"?"Evenement herstellen mislukt.":"Evenement archiveren mislukt.":null})
   }
   case "addWorkplace":{
    const event=uuid(fd.get("event_id"))
    const [start,end]=dates(fd,"default_shift_start","default_shift_end")
    const requested=String(fd.get("sort_order")||"").trim()
    let order:number
    if(requested)order=num().parse(requested)
    else{
     const {data,error}=await client.from("workplaces").select("sort_order")
      .eq("event_id",event).order("sort_order",{ascending:false}).limit(1).maybeSingle()
     if(error)throw Error("Workplace sequence lookup failed")
     order=Math.min(10000,(data?.sort_order??-10)+10)
    }
    requireValid(await client.from("workplaces").insert({
     event_id:event,name:title.parse(fd.get("name")),description:option(fd,"description",1000)||null,
     sort_order:order,default_shift_start:start,default_shift_end:end,
     is_active:true,...capacities(fd)
    }))
    break
   }
   case "updateWorkplace":{
    const workplace=uuid(fd.get("workplace_id"))
    const {data,error}=await client.from("workplaces").select("event_id").eq("id",workplace).single()
    if(error||!data)throw Error("Workplace missing")
    const [start,end]=dates(fd,"default_shift_start","default_shift_end")
    requireValid(await client.from("workplaces").update({
     name:title.parse(fd.get("name")),description:option(fd,"description",1000)||null,
     sort_order:num().parse(fd.get("sort_order")||0),
     default_shift_start:start,default_shift_end:end,is_active:fd.get("is_active")==="on",
     ...capacities(fd)
    }).eq("id",workplace))
    break
   }
   case "addEventMember":await addMember(fd,client,false);break
   case "addAvailableEventMembers":await addMember(fd,client,true);break
   case "assignAvailableCrewShift":await assignCrewShift(fd,client);break
   case "assignResponsible":await assignResponsible(fd,client,actor.id);break
   case "demoteResponsibleToStaff":await demoteResponsible(fd,client);break
   default:return failure(404,"unknown_action")
  }
  return done()
 }catch{
  if(selected.endsWith("WithState"))
   return done({error:selected.includes("restore")?"Evenement herstellen mislukt.":"Evenement archiveren mislukt."})
  return fail()
 }
}
