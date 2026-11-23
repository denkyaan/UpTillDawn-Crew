// Ninth guarded extraction: original text documents, checklist photo and
// personnel cleanup. Main UI and production are unchanged; public writes off.
import {z} from "zod"
import {validateUploadSecurity} from "../../../lib/upload-security.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {approvedAdmin,parseMegaRequest,uuid,done,failure} from "./native-mega-helpers.ts"

export const nativeWaveNineActionIds=[
 "lib/actions/uptilldawn.ts#createInventoryTextEntry",
 "lib/actions/uptilldawn.ts#createPriceListTextEntry",
 "lib/actions/uptilldawn.ts#completeOperationalChecklistItem",
 "lib/actions/personnel.ts#deletePersonnel",
] as const
export type NativeWaveNineActionId=typeof nativeWaveNineActionIds[number]
const ids=new Set<string>(nativeWaveNineActionIds)
export const nativeWaveNineAllowed=(id:string|null):id is NativeWaveNineActionId=>
 typeof id==="string"&&ids.has(id)
const title=z.string().trim().min(1).max(200)
const text=z.string().trim().min(1).max(12000)
function check(result:{error?:unknown}){if(result.error)throw Error("Source operation denied")}
async function writeTextDocument(fd:FormData,db:any,userId:string,priceList:boolean){
 const event=uuid(fd.get("event_id")),workplace=uuid(fd.get("workplace_id"))
 const name=priceList?title.parse(fd.get("workplace_name")):title.parse(fd.get("title"))
 const body=text.parse(fd.get(priceList?"price_list_text":"content"))
 const {data:post,error:postError}=await db.from("workplaces")
  .select("event_id,is_active").eq("id",workplace).single()
 if(postError||!post?.is_active||post.event_id!==event)
  throw Error("Source workplace validation denied")
 const heading=priceList?"Prijslijst · "+name:name
 const safe=name.replace(/[^a-z0-9-_]+/gi,"-").slice(0,priceList?60:80)||
  (priceList?"prijslijst":"inventaris")
 const fileName=priceList?safe+"-prijzen.txt":safe+".txt"
 const path=userId+"/document/"+crypto.randomUUID()+".txt"
 const blob=new Blob([body],{type:"text/plain"})
 check(await db.storage.from("work-media").upload(path,blob,{
  contentType:"text/plain",upsert:false
 }))
 try{
  check(await db.rpc("upt_create_event_document",{
   p_event:event,p_workplace:workplace,p_kind:"technical",p_audience:"employee",
   p_title:heading,p_description:body.slice(0,2000),p_storage_path:path,
   p_file_name:fileName,p_mime_type:"text/plain",
   p_file_size_bytes:new TextEncoder().encode(body).byteLength,
   p_offline_critical:true
  }))
 }catch(error){
  await db.storage.from("work-media").remove([path])
  throw error
 }
}
async function finishChecklistItem(fd:FormData,db:any,userId:string){
 const item=uuid(fd.get("item_id"))
 const raw=fd.get("photo")
 const photo=raw instanceof File&&raw.size>0?raw:null
 // Checklist accepts exactly one optional photo, never extra files.
 for(const [key,value] of fd){
  if(value instanceof File&&value.size>0&&(key!=="photo"||value!==photo))
   throw Error("Unexpected checklist attachment")
 }
 let path:string|undefined
 if(photo){
  const verified=await validateUploadSecurity(photo,{allowDocuments:false})
  if(verified.kind!=="image")throw Error("Not a checklist photo")
  path=userId+"/checklist/"+item+"/"+crypto.randomUUID()+"."+verified.extension
  check(await db.storage.from("work-media").upload(path,photo,{
   contentType:photo.type,upsert:false
  }))
 }
 const result=await db.rpc("upt_set_operational_checklist_item",{
  p_item:item,p_complete:true,...(path?{p_photo_path:path}:{})
 })
 if(result.error&&path)await db.storage.from("work-media").remove([path])
 check(result)
}
async function deleteOriginalPersonnel(fd:FormData,db:any,actor:string){
 const target=uuid(fd.get("user_id"))
 if(target===actor)throw Error("Own account cannot be deleted")
 // Never remove media unless each lookup has succeeded.
 const [profile,attachments]=await Promise.all([
  db.from("profiles").select("profile_photo_url").eq("id",target).maybeSingle(),
  db.from("work_attachments").select("storage_path").eq("uploaded_by",target)
 ])
 if(profile.error||attachments.error)throw Error("Account media lookup failed")
 const paths=(attachments.data||[]).map((row:{storage_path?:string})=>row.storage_path)
  .filter((value:unknown):value is string=>typeof value==="string"&&value.length>0)
 if(paths.length)check(await db.storage.from("work-media").remove(paths))
 if(profile.data?.profile_photo_url)
  check(await db.storage.from("profile-photos").remove([profile.data.profile_photo_url]))
 check(await db.rpc("upt_admin_set_account",{
  p_user:target,p_approved:false,p_role:"__delete__"
 }))
}
export async function nativeWaveNineResponse(
 req:Request,db:NativeAdminActionDb,selected:NativeWaveNineActionId
):Promise<Response>{
 // A 10 MiB checklist image gets a bounded 11 MiB request. Text and
 // account actions keep the original small 64 KiB transport budget.
 const large=selected.endsWith("#completeOperationalChecklistItem")
 const parsed=await parseMegaRequest(req,db,selected,0,
  large?11*1024*1024:64*1024)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 const action=selected.split("#")[1]
 if(action!=="completeOperationalChecklistItem"&&
  !await approvedAdmin(client,actor))return failure(422,"action_failed")
 try{
  switch(action){
   case "createInventoryTextEntry":
    await writeTextDocument(fd,client,actor.id,false);break
   case "createPriceListTextEntry":
    await writeTextDocument(fd,client,actor.id,true);break
   case "completeOperationalChecklistItem":
    await finishChecklistItem(fd,client,actor.id);break
   case "deletePersonnel":
    await deleteOriginalPersonnel(fd,client,actor.id);break
   default:return failure(404,"unknown_action")
  }
  return done()
 }catch{return failure(422,"action_failed")}
}
