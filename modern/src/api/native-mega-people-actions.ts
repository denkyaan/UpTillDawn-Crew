// Wave seven A: eleven exact original crew-account/promotion/receipt actions.
// No UI changes. The public Worker blocks all mutations before this module.
import {z} from "zod"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,hasAdminRole,approvedAdmin,uuid,option,done,redirect,failure} from "./native-mega-helpers.ts"

export const megaPeopleActionIds=[
 "lib/actions/promotion-tasks.ts#createPromotionTask",
 "lib/actions/promotion-tasks.ts#assignGeneralPromotionTask",
 "lib/actions/promotion-tasks.ts#editPromotionTask",
 "lib/actions/promotion-tasks.ts#removeGeneralPromotionAssignment",
 "lib/actions/admin-inventory-batch.ts#receiveAdminInventoryBatch",
 "lib/actions/portal-roles.ts#changePortalRole",
 "lib/actions/personnel-dual-roles.ts#savePersonnelRoleSlot",
 "lib/actions/personnel.ts#setPersonnelBlock",
 "lib/actions/personnel.ts#setPersonnelRole",
 "lib/actions/uptilldawn.ts#approvePersonnelAccount",
 "lib/actions/uptilldawn.ts#setAccountStatus",
] as const
export type MegaPeopleActionId=typeof megaPeopleActionIds[number]
const ids=new Set<string>(megaPeopleActionIds)
export const megaPeopleAllowed=(id:string|null):id is MegaPeopleActionId=>
 typeof id==="string"&&ids.has(id)
const title=z.string().trim().min(1).max(200)
const role=z.enum(["admin","responsible_lead","staff"])
const firstRole=z.enum(["staff","responsible_lead","promotion","administration","head","left_hand","right_hand"])
const leadership=new Set(["head","left_hand","right_hand"])
const adminMessage="De actie kon niet worden uitgevoerd. Probeer opnieuw."
function promotionReturn(fd:FormData,feedback?:string){
 const base=fd.get("admin_view")==="1"?"/admin/management/promotion-tasks":
  "/portals/administration/promotion-tasks"
 const q=option(fd,"return_q",100)
 const scope=String(fd.get("return_scope")||"")
 const raw=Number.parseInt(String(fd.get("return_page")||""),10)
 const page=Number.isFinite(raw)?Math.max(1,Math.min(raw,99999)):1
 const params=new URLSearchParams({
  ...(q?{q}:{}),
  ...(["general","event"].includes(scope)?{scope}:{}),
  ...(page>1?{page:String(page)}:{}),
  ...(feedback?{action_error:feedback}:{saved:"1"})
 })
 return redirect(base+"?"+params)
}
function rolePair(fd:FormData){
 const first=firstRole.parse(fd.get("role_one"))
 const raw=String(fd.get("role_two")||"")
 const second=raw&&raw!=="none"?firstRole.parse(raw):null
 z.enum(["1","2"]).parse(fd.get("save_slot"))
 if(first===second)throw Error("Duplicate personnel roles")
 if((first==="staff"&&second==="responsible_lead")||
  (first==="responsible_lead"&&second==="staff")||
  (leadership.has(first)&&second!==null&&leadership.has(second))||
  (first==="administration"&&second!==null&&leadership.has(second))||
  (second==="administration"&&leadership.has(first)))throw Error("Invalid role pairing")
 return {p_role_one:first,p_role_two:second,p_confirm_head:fd.get("confirm_head")==="yes"}
}
function inventoryRows(fd:FormData){
 if(fd.get("confirm")!=="yes")throw Error("Confirm required")
 const raw=String(fd.get("rows")||"")
 if(raw.length>16000)throw Error("Too many receipt bytes")
 const rows:unknown=JSON.parse(raw)
 if(!Array.isArray(rows)||rows.length<1||rows.length>50)throw Error("Invalid receipt rows")
 const seen=new Set<string>()
 for(const x of rows){
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid receipt row")
  const row=x as Record<string,unknown>
  if(typeof row.line!=="string"||typeof row.item!=="string"||
    !Number.isSafeInteger(row.quantity)||Number(row.quantity)<1||Number(row.quantity)>100000||
    seen.has(String(row.line)))throw Error("Invalid receipt row")
  uuid(row.line);uuid(row.item);seen.add(row.line)
 }
 return rows
}
export async function megaPeopleResponse(req:Request,db:NativeAdminActionDb,selected:MegaPeopleActionId):Promise<Response>{
 const stateIndex=selected==="lib/actions/admin-inventory-batch.ts#receiveAdminInventoryBatch"||
  selected==="lib/actions/personnel-dual-roles.ts#savePersonnelRoleSlot"?1:0
 const parsed=await parseMegaRequest(req,db,selected,stateIndex)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 // These actions use the original permanent/admin role rather than a
 // temporary staff-preview UI mode. The Maker is kept separate from Head Admin.
 if(!hasAdminRole(actor))return failure(422,"action_failed")
 const id=selected.split("#")[1]
 try{
  switch(id){
   case "createPromotionTask":{
    const request=uuid(fd.get("request"))
    const names=[...new Set(fd.getAll("user_id").map(String))]
    if(!names.length||names.length>100)throw Error("Invalid recipients")
    const users=names.map(uuid)
    const {error}=await client.rpc("upt_admin_create_promotion_task",{
     p_request:request,p_title:title.parse(fd.get("title")),
     p_description:String(fd.get("description")||"").slice(0,4000),p_users:users
    })
    return promotionReturn(fd,error?"save":undefined)
   }
   case "assignGeneralPromotionTask":{
    const {error}=await client.rpc("upt_admin_assign_promotion_task",{
     p_task:uuid(fd.get("task_id")),p_user:uuid(fd.get("user_id"))
    })
    return promotionReturn(fd,error?"save":undefined)
   }
   case "editPromotionTask":{
    const expected=String(fd.get("expected_updated_at")||"")
    if(!expected||!Number.isFinite(Date.parse(expected)))throw Error("Invalid version")
    const {error}=await client.rpc("upt_admin_update_promotion_task",{
     p_task:uuid(fd.get("task_id")),p_title:title.parse(fd.get("title")),
     p_description:String(fd.get("description")||"").slice(0,4000),
     p_expected_updated_at:expected
    })
    const code=(error as {code?:string}|null)?.code
    return promotionReturn(fd,code==="40001"?"conflict":error?"save":undefined)
   }
   case "removeGeneralPromotionAssignment":{
    const id=uuid(fd.get("assignment_id"))
    const {data,error:lookup}=await client.from("task_assignments")
     .select("tasks(promotion_only,event_id)").eq("id",id).maybeSingle()
    if(lookup||!data?.tasks?.promotion_only||data.tasks.event_id!==null)
     return promotionReturn(fd,"invalid")
    const {error}=await client.rpc("upt_remove_task_assignment",{p_assignment:id})
    return promotionReturn(fd,error?"save":undefined)
   }
   case "receiveAdminInventoryBatch":{
    const {data:allowed,error:gateError}=await client.rpc("upt_can_manage_administration")
    if(gateError||allowed!==true)return done({ok:false,count:0,code:"denied"})
    try{
     const request=uuid(fd.get("request")),document=uuid(fd.get("document"))
     const rows=inventoryRows(fd)
     const {data,error}=await client.rpc("upt_admin_receive_inventory_batch",{
      p_request:request,p_document:document,p_rows:rows
     })
     if(error||typeof data!=="number"||data<1||data>50)
      return done({ok:false,count:0,code:"rejected"})
     return done({ok:true,count:data,code:null})
    }catch{return done({ok:false,count:0,code:"invalid"})}
   }
   case "changePortalRole":{
    const portals={
     events:["event_staff","event_responsible"],promotion:["promoter"],
     administration:["administrative_staff"]
    } as Record<string,string[]>
    const target=uuid(fd.get("user_id"))
    const portal=String(fd.get("portal")||"")
    const permission=String(fd.get("role")||"")
    const action=String(fd.get("action")||"")
    if(target===actor.id||!portals[portal]?.includes(permission)||
      !["assign_approved","approve","revoke"].includes(action))
      throw Error("Invalid role mutation")
    const {error}=await client.rpc("upt_admin_set_portal_role",{
     p_user_id:target,p_portal:portal,p_role:permission,p_action:action
    })
    if(error)throw Error("Role write denied")
    return done()
   }
   case "savePersonnelRoleSlot":{
    if(actor.account_blocked&&!actor.is_owner)
     return done({error:"Je hebt geen toestemming om rollen te wijzigen."})
    try{
     const target=uuid(fd.get("user_id")),pair=rolePair(fd)
     const {error}=await client.rpc("upt_admin_set_two_personnel_roles",{
      p_user:target,...pair
     })
     if(error){
      const code=(error as {code?:string}).code
      return done({error:code==="23514"?"Draag eerst de Hoofdadminrechten over.":
       code==="42501"?"Alleen de Hoofdadmin kan deze wijziging uitvoeren.":
       code==="23505"?"Deze leidinggevende functie is al toegewezen.":
       code==="22023"?"Deze rolcombinatie is niet toegestaan of vereist extra bevestiging.":
       "Rolwijziging niet uitgevoerd."})
     }
     return redirect("/personnel?feedback=roles_saved&user="+target)
    }catch{return done({error:"Ongeldige rolkeuze. Controleer de velden."})}
   }
   case "setPersonnelBlock":{
    const target=uuid(fd.get("user_id"))
    if(target===actor.id)throw Error("No self block")
    if(!await approvedAdmin(client,actor))return failure(422,"action_failed")
    const {error}=await client.rpc("upt_admin_set_personnel_block",{
     p_user:target,p_blocked:fd.get("blocked")==="true",
     p_reason:option(fd,"reason",1000)
    })
    if(error)throw Error("Block mutation denied")
    return done()
   }
   case "setPersonnelRole":{
    const target=uuid(fd.get("user_id")),requested=role.parse(fd.get("role")||"staff")
    if(target===actor.id&&requested!=="admin")throw Error("No self demotion")
    if(!await approvedAdmin(client,actor))return failure(422,"action_failed")
    const {error}=await client.rpc("upt_admin_set_account",{
     p_user:target,p_approved:true,p_role:requested
    })
    if(error)throw Error("Role mutation denied")
    return done()
   }
   case "approvePersonnelAccount":{
    const target=uuid(fd.get("user_id")),requested=z.enum(["responsible_lead","staff"]).parse(fd.get("role")||"staff")
    if(target===actor.id)throw Error("No self approval")
    if(!await approvedAdmin(client,actor))return failure(422,"action_failed")
    const {error}=await client.rpc("upt_admin_set_account",{
     p_user:target,p_approved:true,p_role:requested
    })
    if(error)throw Error("Approval failed")
    const {error:firstProfileError}=await client.rpc("upt_require_first_profile",{p_user:target})
    if(firstProfileError)throw Error("Profile gate failed")
    const {data:next}=await client.from("profiles").select("id").eq("approved",false)
     .neq("id",target).order("created_at").limit(1).maybeSingle()
    return redirect(next?.id?
     "/personnel?feedback=approved&user="+next.id+"&focus=approval":
     "/personnel?feedback=approved")
   }
   case "setAccountStatus":{
    let feedback="role_saved"
    try{
     if(!await approvedAdmin(client,actor))throw Error("No admin")
     const target=uuid(fd.get("user_id"))
     const status=z.enum(["pending","approved"]).parse(fd.get("status"))
     const requested=role.parse(fd.get("role")||"staff")
     if(target===actor.id&&(status!=="approved"||requested!=="admin"))
      throw Error("No self demotion")
     const {error}=await client.rpc("upt_admin_set_account",{
      p_user:target,p_approved:status==="approved",p_role:requested
     })
     if(error)throw Error("Account mutation failed")
    }catch{feedback="role_error"}
    return redirect("/personnel?feedback="+feedback)
   }
  }
  return failure(404,"unknown_action")
 }catch{
  if(["createPromotionTask","assignGeneralPromotionTask","editPromotionTask","removeGeneralPromotionAssignment"].includes(id))
   return promotionReturn(fd,"invalid")
  return failure(422,"action_failed")
 }
}
