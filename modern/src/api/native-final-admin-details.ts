// Final native administrative inline actions — customer/supplier directory,
// artist bookings, Peppol identity, billing approval, inventory and work queue.
import {administrationDeadline} from "../../../lib/administration/deadline.ts"
import {normalizeEnterprise,peppolPartyIssues,peppolVatCategories} from "../../../lib/administration/peppol.ts"
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,done,redirect,failure,type MegaDb,type AuthContext} from "./native-mega-helpers.ts"

export const finalAdminDetailsActionIds=[
 "app/(app)/portals/administration/counterparties/page.tsx#addCounterparty",
 "app/(app)/portals/administration/counterparties/page.tsx#updateCounterparty",
 "app/(app)/portals/administration/modules/artists/[id]/page.tsx#recordCommunication",
 "app/(app)/portals/administration/modules/artists/[id]/page.tsx#updateBooking",
 "app/(app)/portals/administration/modules/artists/new/page.tsx#createBooking",
 "components/administration/billing-profile.tsx#save",
 "components/administration/billing-profile.tsx#approve",
 "components/administration/inventory-receipts.tsx#receive",
 "components/administration/operational-work-queue.tsx#saveCase",
 "components/administration/peppol-document-fields.tsx#saveReferences",
 "components/administration/peppol-document-fields.tsx#saveLine",
] as const
export type FinalAdminDetailsActionId=typeof finalAdminDetailsActionIds[number]
const names=new Set<string>(finalAdminDetailsActionIds)
export const finalAdminDetailsAllowed=(id:string|null):id is FinalAdminDetailsActionId=>
 typeof id==="string"&&names.has(id)
const str=(f:FormData,k:string)=>String(f.get(k)??"").trim()
const chk=(r:{error?:unknown})=>{if(r.error)throw Error("Database operation rejected")}
const emailValid=(s:string)=>!s||s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
async function administrative(db:MegaDb,a:AuthContext,requireAdmin=false){
 if((!a.approved||a.account_blocked)&&!a.is_owner)throw Error("Account unavailable")
 if(a.is_owner)return
 const isAdmin=await approvedAdmin(db,a)
 if(requireAdmin){if(!isAdmin)throw Error("Admin required");return}
 if(isAdmin)return
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 if(error||!Array.isArray(data)||!data.some((r:any)=>
   r.portal==="administration"&&["administrative_staff","admin"].includes(r.role)
   &&r.approved===true&&r.revoked_at===null))
  throw Error("Administration assignment required")
}
function billingAddress(fd:FormData){
 const street_address=str(fd,"street_address"),postal_code=str(fd,"postal_code")
 const city=str(fd,"city"),country_code=str(fd,"country_code").toUpperCase()
 if(street_address.length>300||postal_code.length>32||city.length>120||
  country_code&&!/^[A-Z]{2}$/.test(country_code)||
  /[\u0000-\u001f]/.test(street_address+postal_code+city))throw Error("Invalid address")
 return {street_address:street_address||null,postal_code:postal_code||null,
  city:city||null,country_code:country_code||null}
}
function counterparty(fd:FormData){
 const name=str(fd,"name"),kind=str(fd,"kind"),vat=str(fd,"vat_number")
 const enterprise=str(fd,"enterprise_number"),email=str(fd,"email")
 if(!name||name.length>200||vat.length>40||enterprise.length>40||
  !["customer","supplier","both"].includes(kind)||!emailValid(email))
  throw Error("Invalid counterparty")
 return {name,kind,vat_number:vat||null,enterprise_number:enterprise||null,
  email:email||null,...billingAddress(fd)}
}
const artists="/portals/administration/modules/artists"
const settings="/portals/administration/modules/settings"
const finance="/portals/administration/finance"
function counterpartyReturn(fd:FormData){
 const q=str(fd,"return_q").slice(0,100),kind=str(fd,"return_kind")
 const raw=Number.parseInt(str(fd,"return_page"),10)
 const page=Number.isFinite(raw)?Math.max(1,Math.min(raw,100000)):1
 const params=new URLSearchParams({...(q?{q}:{}),
  ...(["customer","supplier","both"].includes(kind)?{kind}:{}),
  ...(page>1?{page:String(page)}:{})})
 return "/portals/administration/counterparties"+(params.size?"?"+params:"")
}
const billingFields=["name","street_address","postal_code","city","country_code",
 "enterprise_number","vat_number","tax_registration","peppol_endpoint","iban"] as const
function billingParty(row:Record<string,unknown>){
 return Object.fromEntries(billingFields.map(key=>[key,String(row?.[key]??"")]))
}
function requireOne(r:{data?:unknown;error?:unknown}){
 if(r.error||!Array.isArray(r.data)||r.data.length!==1)throw Error("Concurrent modification")
}
export async function finalAdminDetailsResponse(
 req:Request,db:NativeAdminActionDb,selected:FinalAdminDetailsActionId
):Promise<Response>{
 const parsed=await parseMegaRequest(req,db,selected)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 try{
  const id=selected.split("#")[1],path=selected.split("#")[0]
  if(id==="receive"||id==="approve"&&path.includes("billing-profile"))await administrative(client,actor,true)
  else await administrative(client,actor)
  switch(id){
   case "addCounterparty":
   case "updateCounterparty":{
    const fields=counterparty(fd)
    if(id==="addCounterparty")chk(await client.from("admin_counterparties").insert(fields))
    else{
     const r=await client.from("admin_counterparties").update(fields).eq("id",uuid(fd.get("id")))
      .select("id").maybeSingle()
     if(r.error||!r.data)throw Error("Counterparty update rejected")
    }
    return redirect(id==="addCounterparty"?"/portals/administration/counterparties":counterpartyReturn(fd))
   }
   case "recordCommunication":{
    const booking=uuid(fd.get("id")),kind=str(fd,"kind"),details=str(fd,"details")
    if(!["email_sent","reply_received","follow_up"].includes(kind)||details.length<3||details.length>1500)
     throw Error("Invalid communication")
    const {data,error}=await client.from("admin_artist_bookings").select("id").eq("id",booking).single()
    if(error||!data)throw Error("Booking not found")
    chk(await client.from("admin_artist_booking_communications").insert({
     booking_id:booking,kind,details
    }))
    if(kind==="follow_up")chk(await client.from("admin_artist_bookings")
     .update({follow_up_at:null,updated_at:new Date().toISOString()})
     .eq("id",booking).in("status",["enquiry","negotiating"]))
    return redirect(artists+"/"+booking)
   }
   case "createBooking":{
    const artist=str(fd,"artist_name"),event=uuid(fd.get("event_id"))
    const agency=str(fd,"agency_contact_id"),rider=str(fd,"rider_notes")
    const notes=str(fd,"internal_notes"),feeRaw=str(fd,"fee_amount")
    const fee=feeRaw?Number(feeRaw):null,performance=str(fd,"performance_at")
    const date=performance?new Date(performance):null
    if(!artist||artist.length>180||rider.length>5000||notes.length>5000||
     (fee!==null&&(!Number.isFinite(fee)||fee<0||fee>999999999))||
     (date&&!Number.isFinite(date.getTime())))throw Error("Invalid booking")
    const {data:exists,error:e}=await client.from("events").select("id").eq("id",event).maybeSingle()
    if(e||!exists)throw Error("Event not found")
    if(agency){
     const {data}=await client.from("admin_counterparties").select("id")
      .eq("id",uuid(agency)).maybeSingle()
     if(!data)throw Error("Agency not found")
    }
    const {data,error}=await client.from("admin_artist_bookings").insert({
     artist_name:artist,event_id:event,agency_contact_id:agency?uuid(agency):null,
     rider_notes:rider||null,internal_notes:notes||null,fee_amount:fee,
     performance_at:date?.toISOString()??null,status:"enquiry",currency:"EUR"
    }).select("id").single()
    if(error||!data)throw Error("Booking failed")
    return redirect(fd.get("contract_context")==="1"?artists+"/"+uuid(data.id)+"/agreement":artists)
   }
   case "updateBooking":{
    const booking=uuid(fd.get("id")),status=str(fd,"status")
    const rider=str(fd,"rider_notes"),notesInput=str(fd,"internal_notes"),follow=str(fd,"follow_up_at")
    const date=follow?new Date(follow+"Z"):null
    if(!["enquiry","negotiating","confirmed","cancelled"].includes(status)||
     rider.length>5000||notesInput.length>5000||
     date&&(!Number.isFinite(date.getTime())||date.getTime()<Date.now()-60000))
     throw Error("Invalid booking")
    const {data:old,error}=await client.from("admin_artist_bookings")
     .select("id,status,internal_notes,agency_contact_id,performance_at,fee_amount")
     .eq("id",booking).single()
    if(error||!old)throw Error("Booking not found")
    const transitions:Record<string,string[]>={enquiry:["enquiry","negotiating","cancelled"],
     negotiating:["negotiating","confirmed","cancelled"],confirmed:["confirmed","cancelled"],cancelled:["cancelled"]}
    if(!transitions[old.status]?.includes(status))throw Error("Invalid status transition")
    if(status!==old.status&&(["confirmed","cancelled"].includes(status)||
      ["confirmed","cancelled"].includes(old.status)))await administrative(client,actor,true)
    if(status==="confirmed"&&old.status!=="confirmed"){
     if(!old.agency_contact_id||!old.performance_at||old.fee_amount===null)
      throw Error("Incomplete booking")
     const {data:agency,error:agencyError}=await client.from("admin_counterparties")
      .select("id,email").eq("id",old.agency_contact_id).maybeSingle()
     if(agencyError||!agency?.email||!emailValid(agency.email))throw Error("Valid agency email required")
    }
    const prior=(old.internal_notes??"").split("\n")
     .filter((v:string)=>/^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(v))
    const notes=[notesInput,...prior].filter(Boolean).join("\n")
    let q=client.from("admin_artist_bookings").update({
     status,rider_notes:rider||null,internal_notes:notes||null,
     follow_up_at:["confirmed","cancelled"].includes(status)?null:date?.toISOString()??null,
     updated_at:new Date().toISOString()
    }).eq("id",booking).eq("status",old.status)
    q=old.internal_notes===null?q.is("internal_notes",null):q.eq("internal_notes",old.internal_notes)
    const r=await q.select("id").single()
    if(r.error||!r.data)throw Error("Concurrent booking change")
    return redirect(artists)
   }
   case "save":{
    const values=Object.fromEntries(billingFields.map(k=>[k,str(fd,k)])) as Record<string,string>
    if(Object.values(values).some(v=>v.length>300||/[\u0000-\u001f]/.test(v)))
     return redirect(settings+"?billing=error")
    values.country_code=values.country_code.toUpperCase()
    values.enterprise_number=normalizeEnterprise(values.enterprise_number,values.country_code)
    values.vat_number=values.vat_number.replace(/[.\s-]/g,"").toUpperCase()
    values.iban=values.iban.replace(/\s/g,"").toUpperCase()
    const {data:existing,error}=await client.from("admin_billing_profile")
     .select("updated_at").eq("singleton",true).maybeSingle()
    if(error||String(existing?.updated_at??"")!==str(fd,"version"))
     return redirect(settings+"?billing=error")
    const result=existing?
     await client.from("admin_billing_profile").update(values).eq("singleton",true)
      .eq("updated_at",existing.updated_at).select("singleton"):
     await client.from("admin_billing_profile").insert({...values,singleton:true}).select("singleton")
    if(result.error||result.data?.length!==1)return redirect(settings+"?billing=error")
    return done()
   }
   case "approve":{
    const {data:profile,error}=await client.from("admin_billing_profile")
     .select("*").eq("singleton",true).maybeSingle()
    if(error||!profile||profile.updated_at!==fd.get("version")||
     peppolPartyIssues(billingParty(profile) as any,"seller").length)
     return redirect(settings+"?billing=error")
    const result=await client.from("admin_billing_profile")
     .update({approved_by:actor.id,approved_at:new Date().toISOString()})
     .eq("singleton",true).eq("updated_at",profile.updated_at).select("singleton")
    if(result.error||result.data?.length!==1)return redirect(settings+"?billing=error")
    return done()
   }
   case "receive":{
    const quantity=Number(fd.get("quantity"))
    if(!Number.isInteger(quantity)||quantity<1||quantity>100000)throw Error("Invalid receipt")
    chk(await client.rpc("upt_receive_invoice_inventory",{
     p_request:uuid(fd.get("request")),p_line:uuid(fd.get("line")),
     p_item:uuid(fd.get("item")),p_quantity:quantity
    }))
    return done()
   }
   case "saveCase":{
    const kind=str(fd,"kind"),action=str(fd,"action")||"create"
    if(!["logistics","permits","tasks"].includes(kind))throw Error("Invalid case type")
    const table="admin_operational_obligations",id=str(fd,"id")
    if(action==="create"||action==="edit"){
     const title=str(fd,"title"),details=str(fd,"details")
     if(title.length<3||title.length>180||details.length>4000)throw Error("Invalid case")
     const due=administrationDeadline(str(fd,"deadline"))
     if(action==="create"){
      const event=str(fd,"event")
      chk(await client.from(table).insert({
       kind,title,details,event_id:event?uuid(event):null,due_at:due,created_by:actor.id
      }))
     }else{
      const status=str(fd,"status")
      if(!["open","rejected"].includes(status))throw Error("Invalid case state")
      const result=await client.from(table).update({title,details,due_at:due})
       .eq("id",uuid(id)).eq("kind",kind).eq("status",status)
       .eq("updated_at",str(fd,"updated_at")).select("id")
      requireOne(result)
     }
    }else{
     if(!["submitted","approved","rejected","completed"].includes(action))
      throw Error("Invalid case transition")
     if(["approved","rejected"].includes(action)){
      await administrative(client,actor,true)
      const {data,error}=await client.from(table).select("created_by")
       .eq("id",uuid(id)).eq("kind",kind).eq("status","submitted").maybeSingle()
      if(error||!data)throw Error("Submitted case not found")
     }
     const status=str(fd,"status"),note=str(fd,"note")
     if(note.length>2000||action==="rejected"&&note.length<3)throw Error("Reason missing")
     const changes=action==="rejected"?{status:action,review_note:note}:{status:action}
     const result=await client.from(table).update(changes).eq("id",uuid(id))
      .eq("kind",kind).eq("status",status).eq("updated_at",str(fd,"updated_at"))
      .select("id")
     requireOne(result)
    }
    return done()
   }
   case "saveReferences":{
    const docId=uuid(fd.get("document_id"))
    const {data:doc}=await client.from("admin_financial_documents")
     .select("status").eq("id",docId).maybeSingle()
    if(!doc||doc.status==="void")return redirect(finance+"?error=1")
    if(doc.status!=="draft")await administrative(client,actor,true)
    const buyer=str(fd,"buyer_reference"),order=str(fd,"order_reference")
    const date=str(fd,"delivery_date"),country=str(fd,"delivery_country").toUpperCase()
    const validDate=!date||/^\d{4}-\d{2}-\d{2}$/.test(date)&&
     Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date
    if(buyer.length>200||order.length>200||/[\u0000-\u001f]/.test(buyer+order)||
      !validDate||country&&!/^[A-Z]{2}$/.test(country))
     return redirect(finance+"?error=1")
    const r=await client.from("admin_financial_documents").update({
     buyer_reference:buyer||null,order_reference:order||null,
     delivery_date:date||null,delivery_country:country||null
    }).eq("id",docId).eq("status",doc.status).select("id")
    if(r.error||r.data?.length!==1)return redirect(finance+"?error=1")
    return done()
   }
   case "saveLine":{
    const line=uuid(fd.get("line_id")),docId=uuid(fd.get("document_id"))
    const unit=str(fd,"unit_code")||"C62",category=str(fd,"vat_category"),reason=str(fd,"vat_exemption_reason")
    if(!/^[A-Z0-9]{1,3}$/.test(unit)||
       category&&!(peppolVatCategories as readonly string[]).includes(category)||
       reason.length>500||/[\u0000-\u001f]/.test(reason))
     return redirect(finance+"?error=1")
    const {data:doc}=await client.from("admin_financial_documents")
     .select("status").eq("id",docId).maybeSingle()
    if(doc?.status!=="draft")return redirect(finance+"?error=1")
    const r=await client.from("admin_financial_lines").update({
     unit_code:unit,vat_category:category||null,vat_exemption_reason:reason||null
    }).eq("id",line).eq("document_id",docId).select("id")
    if(r.error||r.data?.length!==1)return redirect(finance+"?error=1")
    return done()
   }
   default:return failure(404,"unknown_action")
  }
 }catch{return failure(422,"action_failed")}
}
