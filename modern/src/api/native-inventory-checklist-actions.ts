// Fourth disabled native action wave: inventory tracking and checklist
// lifecycle. Original action IDs, field names and audited RPCs only.
import {z} from "zod"
import {boundedMigrationForm} from "../../../lib/migration/bounded-form.ts"
import {decode,encode} from "../../../lib/migration/wire.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"

export const nativeInventoryManagerActionIds=[
 "lib/actions/uptilldawn.ts#createInventoryItem",
 "lib/actions/uptilldawn.ts#updateInventoryAssetDetails",
 "lib/actions/uptilldawn.ts#reportWorkplaceInventoryCondition",
 "lib/actions/uptilldawn.ts#restockInventoryItem",
 "lib/actions/uptilldawn.ts#issueInventoryItem",
 "lib/actions/uptilldawn.ts#decideInventorySettlement",
 "lib/actions/uptilldawn.ts#restoreInventoryQuantity",
 "lib/actions/uptilldawn.ts#applyOperationalChecklistTemplate",
 "lib/actions/uptilldawn.ts#addOperationalChecklistItem",
 "lib/actions/uptilldawn.ts#closeOperationalChecklist",
 "lib/actions/uptilldawn.ts#reopenOperationalChecklist",
] as const
export const nativeInventoryMemberActionIds=[
 "lib/actions/uptilldawn.ts#settleInventoryIssue",
 "lib/actions/uptilldawn.ts#requestInventorySettlement",
 "lib/actions/uptilldawn.ts#cancelInventorySettlement",
] as const
export const nativeInventoryActionIds=[...nativeInventoryManagerActionIds,...nativeInventoryMemberActionIds] as const
export type NativeInventoryActionId=typeof nativeInventoryActionIds[number]
const exactIds=new Set<string>(nativeInventoryActionIds)
const managerIds=new Set<string>(nativeInventoryManagerActionIds)
export const nativeInventoryActionAllowed=(id:string|null):id is NativeInventoryActionId=>
 typeof id==="string"&&exactIds.has(id)

const uuid=z.string().uuid()
const text=z.string().trim().min(1).max(200)
const count=z.coerce.number().int().min(1).max(100000)
const kind=z.enum(["asset","consumable"])
const condition=z.enum(["returned","damaged","missing"])
const badCondition=z.enum(["damaged","missing"])
const phase=z.enum(["opening","closing"])
const decision=z.enum(["approved","rejected"])
const notes=(fd:FormData)=>String(fd.get("notes")||"").trim().slice(0,1000)||undefined
const failure=(status:number,code:string)=>Response.json(
 {error:"De actie kon niet worden uitgevoerd. Probeer opnieuw.",code},
 {status,headers:{"Cache-Control":"private, no-store"}}
)
type Command={rpc:string;args:Record<string,unknown>}

export function originalInventoryCommand(id:NativeInventoryActionId,fd:FormData):Command{
 switch(id){
  case "lib/actions/uptilldawn.ts#createInventoryItem":
   return {rpc:"upt_create_inventory_item",args:{
    p_workplace:uuid.parse(fd.get("workplace_id")),
    p_name:text.parse(fd.get("name")),
    p_category:String(fd.get("category")||"").trim().slice(0,120)||undefined,
    p_quantity:count.parse(fd.get("quantity")),
    p_item_kind:kind.parse(fd.get("item_kind")||"consumable")
   }}
  case "lib/actions/uptilldawn.ts#updateInventoryAssetDetails":
   return {rpc:"upt_set_inventory_asset_details",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_kind:kind.parse(fd.get("item_kind")),
    p_asset_code:String(fd.get("asset_code")||"").trim().slice(0,120)||undefined,
    p_barcode:String(fd.get("barcode")||"").trim().slice(0,120)||undefined,
    p_serial_number:String(fd.get("serial_number")||"").trim().slice(0,200)||undefined
   }}
  case "lib/actions/uptilldawn.ts#reportWorkplaceInventoryCondition":
   return {rpc:"upt_report_workplace_inventory_condition",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_phase:phase.parse(fd.get("phase")),
    p_condition:badCondition.parse(fd.get("condition")),
    p_quantity:count.parse(fd.get("quantity")),
    p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#restockInventoryItem":
   return {rpc:"upt_restock_inventory_item",args:{
    p_item:uuid.parse(fd.get("item_id")),p_quantity:count.parse(fd.get("quantity")),
    p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#issueInventoryItem":
   return {rpc:"upt_issue_inventory",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_user:uuid.parse(fd.get("user_id")),p_quantity:count.parse(fd.get("quantity")),
    p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#settleInventoryIssue":
   return {rpc:"upt_settle_inventory_issue",args:{
    p_issue:uuid.parse(fd.get("issue_id")),
    p_condition:condition.parse(fd.get("condition")),
    p_quantity:count.parse(fd.get("quantity")),p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#requestInventorySettlement":
   return {rpc:"upt_request_inventory_settlement",args:{
    p_issue:uuid.parse(fd.get("issue_id")),
    p_condition:condition.parse(fd.get("condition")),
    p_quantity:count.parse(fd.get("quantity")),p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#cancelInventorySettlement":
   return {rpc:"upt_cancel_inventory_settlement",args:{
    p_request:uuid.parse(fd.get("request_id"))
   }}
  case "lib/actions/uptilldawn.ts#decideInventorySettlement":{
   const outcome=decision.parse(fd.get("decision"))
   const note=String(fd.get("note")||"").trim().slice(0,1000)
   if(outcome==="rejected"&&note.length<3)throw Error("Invalid rejection reason")
   return {rpc:"upt_decide_inventory_settlement",args:{
    p_request:uuid.parse(fd.get("request_id")),
    p_decision:outcome,...(note?{p_note:note}:{})
   }}
  }
  case "lib/actions/uptilldawn.ts#restoreInventoryQuantity":
   return {rpc:"upt_restore_inventory_quantity",args:{
    p_item:uuid.parse(fd.get("item_id")),
    p_condition:badCondition.parse(fd.get("condition")),
    p_quantity:count.parse(fd.get("quantity")),p_notes:notes(fd)
   }}
  case "lib/actions/uptilldawn.ts#applyOperationalChecklistTemplate":
   return {rpc:"upt_apply_operational_checklist_template",args:{
    p_template:uuid.parse(fd.get("template_id")),
    p_event:uuid.parse(fd.get("event_id")),
    p_workplace:uuid.parse(fd.get("workplace_id"))
   }}
  case "lib/actions/uptilldawn.ts#addOperationalChecklistItem":
   return {rpc:"upt_add_operational_checklist_item",args:{
    p_checklist:uuid.parse(fd.get("checklist_id")),
    p_label:z.string().trim().min(1).max(300).parse(fd.get("label")),
    p_required:fd.get("required")==="on",
    p_requires_photo:fd.get("requires_photo")==="on"
   }}
  case "lib/actions/uptilldawn.ts#closeOperationalChecklist":
   return {rpc:"upt_close_operational_checklist",args:{
    p_checklist:uuid.parse(fd.get("checklist_id"))
   }}
  case "lib/actions/uptilldawn.ts#reopenOperationalChecklist":
   return {rpc:"upt_reopen_operational_checklist",args:{
    p_checklist:uuid.parse(fd.get("checklist_id"))
   }}
 }
}

export async function nativeInventoryActionResponse(
 request:Request,db:NativeAdminActionDb,selected:NativeInventoryActionId
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
  const {data:profiles,error:profileError}=await db.rpc("upt_current_profile")
  const profile=Array.isArray(profiles)?profiles[0]:null
  if(profileError||profile?.approved!==true||profile?.account_blocked===true)
   return failure(422,"action_failed")
  if(managerIds.has(selected)){
   const {data:effectiveRole,error:roleError}=await db.rpc("upt_current_effective_role")
   if(roleError||!(["admin","responsible_lead"].includes(
    typeof effectiveRole==="string"&&effectiveRole?effectiveRole:String(profile.role||"")
   )))return failure(422,"action_failed")
  }
  const command=originalInventoryCommand(selected,args[0])
  const {error}=await db.rpc(command.rpc,command.args)
  if(error)return failure(422,"action_failed")
  return Response.json({value:encode(undefined,new FormData()),refresh:true},{
   headers:{"Cache-Control":"private, no-store"}
  })
 }catch{return failure(422,"action_failed")}
}
