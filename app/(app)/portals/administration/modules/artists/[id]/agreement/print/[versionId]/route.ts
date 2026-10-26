import {notFound,redirect} from "next/navigation"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {buildContractDocument} from "@/lib/administration/contract-document"
import {renderContractPrintHtml} from "@/lib/administration/contract-print"

export const dynamic="force-dynamic"

export async function GET(_request:Request,{params}:{params:Promise<{id:string;versionId:string}>}){
 const {id,versionId}=await params
 const valid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
 if(!valid(id)||!valid(versionId))notFound()
 const user=await getCurrentUser()
 if(!user)redirect("/login")
 if((!user.approved||user.account_blocked)&&!user.isOwner)redirect("/portals")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{approved:user.approved,blocked:Boolean(user.account_blocked)}))redirect("/portals")
 }
 const {data:version,error}=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,snapshot,approved_at").eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(error||!version?.approved_at)notFound()
 const snapshot=version.snapshot
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))notFound()
 const values=snapshot as Record<string,unknown>
 const str=(key:string)=>typeof values[key]==="string"?values[key] as string:""
 const terms={
  payment:str("agreement_payment_terms"),
  cancellation:str("agreement_cancellation_terms"),
  liability:str("agreement_liability_terms"),
  governing_law:str("agreement_governing_law")
 }
 if(Object.values(terms).some(value=>!value))notFound()
 const fee=typeof values.fee_amount==="number"?values.fee_amount:null
 if(fee!==null)terms.payment+="\nAgreed fee: "+fee+" "+str("currency")
 const doc=buildContractDocument({
  documentId:version.id,documentType:"artist",version:version.version_number,
  eventName:str("event_name"),eventDate:str("event_start_at"),
  issuer:{name:"Up Till Dawn",email:process.env.CONTRACT_ISSUER_EMAIL??"contracts@uptilldawn.be"},
  recipient:{name:str("agency_name"),email:str("agency_email")},
  terms,approvedAt:version.approved_at
 })
 const html=renderContractPrintHtml(doc)
 return new Response(html,{headers:{
  "Content-Type":"text/html; charset=utf-8",
  "Cache-Control":"private, no-store",
  "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options":"nosniff",
  "Content-Disposition":'inline; filename="agreement-'+version.version_number+'.html"'
 }})
}
