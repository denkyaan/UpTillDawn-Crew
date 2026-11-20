import "server-only"
import {getCurrentUser} from "@/lib/actions/auth"
import {createClient} from "@/lib/supabase/crew-server"
import {canOpenPortal,type PortalAssignment} from "@/lib/portal-access"
import {authorizedSigningLedger} from "./contract-signing-supabase"
import {signingDispatchEnabled} from "./documenso"

/**
 * Read-only operator preflight. Never accepts document approval, digest,
 * archived PDF paths, or envelope state from browser input.
 * This deliberately cannot trigger a signature email.
 */
export async function getArtistSigningDispatchPreflight(input:{
 bookingId:string;agreementVersionId:string
}):Promise<{
 ready:false
 reasons:string[]
 status:string|null
}>{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(input.bookingId)||!uuid.test(input.agreementVersionId))throw new Error("Invalid contract identity")
 const user=await getCurrentUser()
 if(!user||(!user.approved&&!user.isOwner)||(user.account_blocked&&!user.isOwner))throw new Error("Access denied")
 const db=await createClient()
 if(!user.isAdmin&&!user.isOwner){
  const {data,error}=await db.rpc("upt_my_portal_assignments")
  if(error||!canOpenPortal("administration",(data??[]) as PortalAssignment[],{
   approved:user.approved,blocked:Boolean(user.account_blocked)
  }))throw new Error("Access denied")
 }
 const {data:version,error}=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,approved_at").eq("id",input.agreementVersionId)
  .eq("booking_id",input.bookingId).maybeSingle()
 if(error||!version)throw new Error("Agreement version not accessible")
 const reasons:string[]=[]
 if(!version.approved_at)reasons.push("approval_missing")
 const ledger=await authorizedSigningLedger()
 const record=await ledger.load({
  documentType:"artist",documentId:version.id,version:version.version_number
 })
 if(!record)reasons.push("signing_request_missing")
 else{
  if(!record.envelopeId)reasons.push("envelope_missing")
  if(record.state!=="draft")reasons.push("not_draft")
 }
 if(!signingDispatchEnabled())reasons.push("dispatch_disabled")
 // Read-only preflight never claims readiness until trusted archive and
 // immutable document verification are performed in the sending transaction.
 reasons.push("archive_verification_required")
 return {ready:false,reasons,status:record?.state??null}
}
