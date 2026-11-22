// First portable server-action wave. Exact original IDs, FormData names,
// Zod validators and audited Supabase RPCs from lib/actions/{guestlist,sales,platform}.ts.
// Never use a browser role or import Next.js, admin secrets or service-role keys.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"

export type NativeAdminActionDb={
 auth:{getUser:()=>Promise<{data:{user:{id:string}|null};error:unknown}>},
 rpc:(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{message?:string}|null}>
}
export const nativeAdminActionIds=[
 "lib/actions/guestlist.ts#addGuestlistEntry",
 "lib/actions/guestlist.ts#updateGuestlistEntry",
 "lib/actions/guestlist.ts#removeGuestlistEntry",
 "lib/actions/guestlist.ts#setBackstageWorkplace",
 "lib/actions/guestlist.ts#setArtistHospitality",
 "lib/actions/sales.ts#configureSaleItem",
 "lib/actions/sales.ts#setOpeningCash",
 "lib/actions/sales.ts#refundSale",
 "lib/actions/platform.ts#generatePlanningRecommendations",
 "lib/actions/platform.ts#applyPlanningRecommendation",
 "lib/actions/platform.ts#dismissPlanningRecommendation",
 "lib/actions/platform.ts#generateEventReport",
] as const
export type NativeAdminActionId=typeof nativeAdminActionIds[number]
const actionSet=new Set<string>(nativeAdminActionIds)
export function nativeAdminActionAllowed(id:string|null):id is NativeAdminActionId{
 return typeof id==="string"&&actionSet.has(id)
}
const uuid=z.string().uuid()
const entryType=z.enum(["artist","guest"])
const category=z.enum(["merch","token"])
const int=(min:number,max:number)=>z.coerce.number().int().min(min).max(max)
const failure=(status:number,code:string)=>Response.json(
 {error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code},
 {status,headers:{"Cache-Control":"private, no-store"}}
)
function euroToCents(value:FormDataEntryValue|null):number{
 const normalized=String(value||"").trim().replace(",",".")
 const amount=Number(normalized)
 if(!Number.isFinite(amount)||amount<0||amount>100000)
  throw Error("Geef een geldig bedrag.")
 return Math.round(amount*100)
}
function guestFields(fd:FormData){
 return {
  p_name:z.string().trim().min(1).max(240).parse(fd.get("name")),
  p_entry_type:entryType.parse(fd.get("entry_type")),
  p_spots:int(1,100).parse(fd.get("spots")||1),
  p_notes:String(fd.get("notes")||"").trim().slice(0,2000)||undefined
 }
}
type Command={rpc:string;args:Record<string,unknown>}
export function originalAdminCommand(id:NativeAdminActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/guestlist.ts#addGuestlistEntry":
   return {rpc:"upt_guestlist_add_entry",args:{
    p_event:uuid.parse(fd.get("event_id")),...guestFields(fd)
   }}
  case "lib/actions/guestlist.ts#updateGuestlistEntry":
   return {rpc:"upt_guestlist_update_entry",args:{
    p_entry:uuid.parse(fd.get("entry_id")),...guestFields(fd)
   }}
  case "lib/actions/guestlist.ts#removeGuestlistEntry":
   return {rpc:"upt_guestlist_remove_entry",args:{p_entry:uuid.parse(fd.get("entry_id"))}}
  case "lib/actions/guestlist.ts#setBackstageWorkplace":
   return {rpc:"upt_guestlist_set_backstage_workplace",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_workplace:uuid.parse(fd.get("workplace_id"))
   }}
  case "lib/actions/guestlist.ts#setArtistHospitality":
   return {rpc:"upt_guestlist_set_artist_hospitality",args:{
    p_entry:uuid.parse(fd.get("entry_id")),
    p_drinks:String(fd.get("drinks")||"").trim().slice(0,3000)||undefined,
    p_notes:String(fd.get("hospitality_notes")||"").trim().slice(0,3000)||undefined
   }}
  case "lib/actions/sales.ts#configureSaleItem":{
   const enabled=fd.get("enabled")==="on"
   return {rpc:"upt_sales_configure_item",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_enabled:enabled,
    p_category:enabled?category.parse(fd.get("sale_category")):undefined,
    p_price_cents:enabled?euroToCents(fd.get("price")):undefined
   }}
  }
  case "lib/actions/sales.ts#setOpeningCash":
   return {rpc:"upt_sales_set_opening_cash",args:{
    p_event:uuid.parse(fd.get("event_id")),
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_opening_cash_cents:euroToCents(fd.get("opening_cash"))
   }}
  case "lib/actions/sales.ts#refundSale":
   return {rpc:"upt_sales_refund",args:{
    p_sale:uuid.parse(fd.get("sale_id")),
    p_quantity:int(1,10000).parse(fd.get("quantity")||1),
    p_notes:String(fd.get("notes")||"").trim().slice(0,1000)||undefined
   }}
  case "lib/actions/platform.ts#generatePlanningRecommendations":
   return {rpc:"upt_generate_planning_recommendations",args:{p_event:uuid.parse(fd.get("event_id"))}}
  case "lib/actions/platform.ts#applyPlanningRecommendation":
   return {rpc:"upt_apply_planning_recommendation",args:{p_recommendation:uuid.parse(fd.get("recommendation_id"))}}
  case "lib/actions/platform.ts#dismissPlanningRecommendation":
   return {rpc:"upt_dismiss_planning_recommendation",args:{p_recommendation:uuid.parse(fd.get("recommendation_id"))}}
  case "lib/actions/platform.ts#generateEventReport":
   return {rpc:"upt_generate_event_report",args:{p_event:uuid.parse(fd.get("event_id"))}}
 }
}
/**
 * Only execute when the *server-side* QA write flag is explicitly enabled.
 * The caller must also require a verified original signed session. The hint
 * selects parsing only; matching _id is mandatory and provides NO authority.
 * All 12 actions keep the original admin/approved checks + RLS SQL audit.
 */
export async function nativeAdminActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeAdminActionId
):Promise<Response>{
 const url=new URL(request.url)
 const site=request.headers.get("sec-fetch-site")
 if(request.headers.get("origin")!==url.origin||
    (site&&site!=="same-origin"))return failure(403,"migration_disabled")
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
  const [{data:approved,error:approvedError},{data:isAdmin,error:adminError}]=await Promise.all([
   db.rpc("upt_is_approved"),db.rpc("upt_is_admin",{uid:user.id})
  ])
  if(approvedError||adminError||approved!==true||isAdmin!==true)
   return failure(422,"action_failed")
  const command=originalAdminCommand(selected,args[0])
  const {error}=await db.rpc(command.rpc,command.args)
  if(error)return failure(422,"action_failed")
  // React SPA uses this same refresh signal after every original Next action.
  const files=new FormData()
  return Response.json({value:encode(undefined,files),refresh:true},
   {headers:{"Cache-Control":"private, no-store"}})
 }catch{return failure(422,"action_failed")}
}
