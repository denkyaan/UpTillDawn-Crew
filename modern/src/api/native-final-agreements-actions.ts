// Native artist-agreement actions. Server-side identity and RLS remain
// authoritative, and remote signing status is read-only, never auto-approved.
import type {NativeAdminActionDb} from "./native-admin-actions.ts"
import {parseMegaRequest,approvedAdmin,uuid,done,redirect,failure,type MegaDb,type AuthContext} from "./native-mega-helpers.ts"

const source="app/(app)/portals/administration/modules/artists/[id]/agreement/page.tsx#"
export const finalAgreementsActionIds=[
 source+"saveTerms",source+"snapshotAgreement",source+"approveAgreement",
 source+"prepareSignature",source+"cancelSignaturePreparation",source+"refreshSigning",
] as const
export type FinalAgreementsActionId=typeof finalAgreementsActionIds[number]
const accepted=new Set<string>(finalAgreementsActionIds)
export const finalAgreementsAllowed=(id:string|null):id is FinalAgreementsActionId=>
 typeof id==="string"&&accepted.has(id)
const str=(f:FormData,k:string)=>String(f.get(k)??"").trim()
const path="/portals/administration/modules/artists/"
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
async function administration(db:MegaDb,actor:AuthContext,adminOnly=false){
 if((!actor.approved||actor.account_blocked)&&!actor.is_owner)throw Error("Account disabled")
 if(actor.is_owner)return
 const isAdmin=await approvedAdmin(db,actor)
 if(adminOnly){if(!isAdmin)throw Error("Admin required");return}
 if(isAdmin)return
 const {data,error}=await db.rpc("upt_my_portal_assignments")
 if(error||!Array.isArray(data)||!data.some((r:any)=>r.portal==="administration"&&
   ["administrative_staff","admin"].includes(r.role)&&r.approved===true&&r.revoked_at===null))
  throw Error("Missing Administration assignment")
}
const updated=(id:string)=>redirect(path+id+"/agreement")
export async function finalAgreementsResponse(
 req:Request,db:NativeAdminActionDb,selected:FinalAgreementsActionId,
 config:{DOCUMENSO_API_KEY?:string;DOCUMENSO_BASE_URL?:string}={}
):Promise<Response>{
 const parsed=await parseMegaRequest(req,db,selected)
 if(!parsed.ok)return parsed.response
 const {fd,actor,db:client}=parsed
 const name=selected.slice(source.length)
 try{
  await administration(client,actor)
  if(name==="saveTerms"){
   const booking=uuid(fd.get("id"))
   const fields=["agreement_payment_terms","agreement_cancellation_terms",
    "agreement_liability_terms","agreement_governing_law"] as const
   const values=Object.fromEntries(fields.map(k=>[k,str(fd,k)||null])) as Record<string,string|null>
   if(Object.values(values).some(v=>v!==null&&v.length>3000))throw Error("Terms too long")
   const {data,error}=await client.from("admin_artist_bookings")
    .update({...values,updated_at:new Date().toISOString()}).eq("id",booking)
    .in("status",["enquiry","negotiating"]).select("id").maybeSingle()
   if(error||!data)throw Error("Agreement not editable")
   return updated(booking)
  }
  if(name==="snapshotAgreement"){
   const booking=uuid(fd.get("id"))
   const {data,error}=await client.from("admin_artist_bookings")
    .select("id,artist_name,status,event_id,agency_contact_id,performance_at,fee_amount,currency,rider_notes,agreement_payment_terms,agreement_cancellation_terms,agreement_liability_terms,agreement_governing_law")
    .eq("id",booking).single()
   if(error||!data||data.status==="cancelled"||!data.artist_name?.trim()||
      !data.agency_contact_id||!data.performance_at||data.fee_amount===null||
      !Number.isFinite(Number(data.fee_amount))||Number(data.fee_amount)<0||
      !data.currency||!data.rider_notes?.trim()||!data.agreement_payment_terms||
      !data.agreement_cancellation_terms||!data.agreement_liability_terms||
      !data.agreement_governing_law)throw Error("Incomplete agreement")
   const [a,e]=await Promise.all([
    client.from("admin_counterparties").select("name,email")
     .eq("id",data.agency_contact_id).maybeSingle(),
    client.from("events").select("name,start_at").eq("id",data.event_id).maybeSingle()
   ])
   if(a.error||e.error||!a.data?.name?.trim()||!a.data?.email?.trim()||
      !e.data?.name?.trim()||!e.data?.start_at||
      !email.test(a.data.email.trim())||!Number.isFinite(Date.parse(e.data.start_at))||
      !Number.isFinite(Date.parse(data.performance_at)))
    throw Error("Invalid agreement parties")
   const snapshot={...data,agency_name:a.data.name,agency_email:a.data.email,
    event_name:e.data.name,event_start_at:e.data.start_at}
   const {data:previous,error:readError}=await client.from("admin_artist_agreement_versions")
    .select("version_number").eq("booking_id",booking)
    .order("version_number",{ascending:false}).limit(1).maybeSingle()
   if(readError)throw Error("Cannot determine agreement version")
   const version=Number(previous?.version_number??0)+1
   if(!Number.isSafeInteger(version)||version<1)throw Error("Agreement version overflow")
   const {error:insertError}=await client.from("admin_artist_agreement_versions")
    .insert({booking_id:booking,version_number:version,snapshot})
   if(insertError)throw Error("Agreement version conflicted")
   return updated(booking)
  }
  if(name==="approveAgreement"){
   await administration(client,actor,true)
   const booking=uuid(fd.get("id")),version=uuid(fd.get("version_id"))
   const {data,error}=await client.from("admin_artist_agreement_versions")
    .select("id,created_by,approved_at").eq("id",version)
    .eq("booking_id",booking).maybeSingle()
   if(error||!data||data.approved_at||data.created_by===actor.id)
    throw Error("Separate reviewer required")
   const r=await client.from("admin_artist_agreement_versions")
    .update({approved_by:actor.id,approved_at:new Date().toISOString()})
    .eq("id",version).eq("booking_id",booking).is("approved_at",null)
    .select("id").maybeSingle()
   if(r.error||!r.data)throw Error("Approval conflict")
   return updated(booking)
  }
  if(name==="prepareSignature"){
   const booking=uuid(fd.get("id")),version=uuid(fd.get("version_id"))
   const recipient=str(fd,"recipient_email").toLowerCase()
   if(recipient.length>320||!email.test(recipient))throw Error("Invalid signer")
   const {data:approved,error:aError}=await client.from("admin_artist_agreement_versions")
    .select("id,version_number,approved_at").eq("id",version)
    .eq("booking_id",booking).maybeSingle()
   if(aError||!approved?.approved_at||
      !Number.isSafeInteger(approved.version_number)||approved.version_number<1)
    throw Error("Approved agreement version required")
   const approvedWhen=Date.parse(approved.approved_at)
   if(!Number.isFinite(approvedWhen)||approvedWhen>Date.now()+60000)
    throw Error("Unverifiable agreement approval")
   const {data:trusted,error:tError}=await client.from("admin_artist_agreement_versions")
    .select("id,version_number,approved_at").eq("id",version)
    .eq("version_number",approved.version_number).maybeSingle()
   if(tError||trusted?.id!==version||
      trusted.approved_at!==approved.approved_at)
    throw Error("Agreement approval changed")
   const {data:target,error:bookingError}=await client.from("admin_artist_bookings")
    .select("agency_contact_id,status").eq("id",booking).maybeSingle()
   if(bookingError||!target?.agency_contact_id||target.status==="cancelled")
    throw Error("Booking unavailable")
   const {data:agency,error:agencyError}=await client.from("admin_counterparties")
    .select("email").eq("id",target.agency_contact_id).maybeSingle()
   if(agencyError||!agency?.email||agency.email.trim().toLowerCase()!==recipient)
    throw Error("Signer mismatch")
   const {error:insertError}=await client.from("admin_artist_agreement_signature_requests")
    .insert({agreement_version_id:version,recipient_email:recipient})
   if(insertError)throw Error("Signature preparation failed")
   return updated(booking)
  }
  if(name==="cancelSignaturePreparation"){
   const booking=uuid(fd.get("id")),request=uuid(fd.get("request_id"))
   const {data:signature,error:sError}=await client.from("admin_artist_agreement_signature_requests")
    .select("id,agreement_version_id,status").eq("id",request).maybeSingle()
   if(sError||!signature||signature.status!=="prepared")
    throw Error("Signature not in prepared state")
   const {data:version,error:vError}=await client.from("admin_artist_agreement_versions")
    .select("id").eq("id",signature.agreement_version_id)
    .eq("booking_id",booking).maybeSingle()
   if(vError||!version)throw Error("Signature belongs to a different booking")
   const {data,error}=await client.rpc("upt_cancel_artist_signature_preparation",{p_request_id:request})
   if(error||!data)throw Error("Cancellation failed")
   return updated(booking)
  }
  if(name==="refreshSigning"){
   const booking=uuid(fd.get("booking_id")),version=uuid(fd.get("version_id"))
   const sequence=Number(str(fd,"version"))
   if(!Number.isSafeInteger(sequence)||sequence<1)throw Error("Invalid version")
   const {data:approved,error}=await client.from("admin_artist_agreement_versions")
    .select("id").eq("id",version).eq("booking_id",booking)
    .eq("version_number",sequence).not("approved_at","is",null).maybeSingle()
   if(error||!approved)throw Error("Unapproved version")
   // The source refresh is intentionally read-only. Default-deny ledger RLS
   // must not be bypassed with a service-role secret.
   const {data:row,error:ledgerError}=await client.from("administration_contract_signing_requests")
    .select("document_id,document_version,envelope_id,status")
    .eq("document_type","artist").eq("document_id",version)
    .eq("document_version",sequence).maybeSingle()
   if(ledgerError||!row?.envelope_id)throw Error("Signing envelope unavailable")
   const base=(config.DOCUMENSO_BASE_URL||"https://app.documenso.com").replace(/\/$/,"")
   const url=new URL(base)
   if(url.protocol!=="https:"||url.username||url.password||
      !/^(?:[a-z0-9-]+\.)*documenso\.com$/i.test(url.hostname)||
      !config.DOCUMENSO_API_KEY||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(row.envelope_id))
    throw Error("Signing provider not connected")
   const response=await fetch(base+"/api/v2/envelope/"+encodeURIComponent(row.envelope_id),{
    headers:{Authorization:config.DOCUMENSO_API_KEY,Accept:"application/json"},
    signal:AbortSignal.timeout(20000),redirect:"error"
   })
   if(!response.ok||Number(response.headers.get("content-length")||0)>65536)
    throw Error("Signing provider unavailable")
   const raw=await response.text()
   if(raw.length>65536)throw Error("Signing response oversized")
   const remote=JSON.parse(raw)
   if(remote?.id!==row.envelope_id||
      !["DRAFT","PENDING","COMPLETED","REJECTED","CANCELLED"].includes(remote?.status))
    throw Error("Signing envelope mismatch")
   const next:Record<string,readonly string[]>={
    draft:["DRAFT","PENDING","COMPLETED","REJECTED","CANCELLED"],
    sent:["PENDING","COMPLETED","REJECTED","CANCELLED"],
    completed:["COMPLETED"],rejected:["REJECTED"],cancelled:["CANCELLED"]
   }
   if(!next[row.status]?.includes(remote.status))throw Error("Unexpected signing transition")
   // Do not persist a provider-reported transition until the separate
   // verified ledger reconciliation transaction has been deployed.
   return updated(booking)
  }
  return failure(404,"unknown_action")
 }catch{return failure(422,"action_failed")}
}
