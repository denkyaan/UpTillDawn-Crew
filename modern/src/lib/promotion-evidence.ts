import {supabase} from "./supabase"
import {verifyOwnSession,requireUuid} from "./operational-writes"
import {validPhotoSignature} from "../shared/profile-validation"
import {validReviewReason,type EvidenceVerdict} from "../shared/approval-validation"

export type Evidence={id:string;assignment_id:string;verification_status:string;submitted_at:string;verified_at:string|null}
export async function ownPromotionEvidence(uid:string,signal:AbortSignal):Promise<Evidence[]>{
 const {data,error}=await supabase().from("promotion_evidence")
  .select("id,assignment_id,verification_status,submitted_at,verified_at")
  .eq("submitted_by",uid).order("submitted_at",{ascending:false})
  .limit(80).abortSignal(signal)
 if(error)throw new Error("promotion_evidence_unavailable")
 return (data||[]) as Evidence[]
}
export async function adminPromotionEvidence(signal:AbortSignal):Promise<Evidence[]>{
 // Only admin may see another user's evidence through the existing RLS policy.
 const {data,error}=await supabase().from("promotion_evidence")
  .select("id,assignment_id,verification_status,submitted_at,verified_at")
  .order("submitted_at",{ascending:false}).limit(80).abortSignal(signal)
 if(error)throw new Error("promotion_evidence_review_unavailable")
 return (data||[]) as Evidence[]
}
export async function uploadOwnPromotionEvidence(uid:string,assignmentId:string,file:File):Promise<string>{
 requireUuid(uid);requireUuid(assignmentId)
 if(!navigator.onLine)throw new Error("evidence_requires_online")
 if(!file||file.size<1||file.size>10*1024*1024)throw new Error("invalid_evidence_size")
 const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":file.type==="image/webp"?"webp":null
 if(!ext)throw new Error("invalid_evidence_type")
 const raw=await file.arrayBuffer()
 if(!validPhotoSignature(file.type,new Uint8Array(raw.slice(0,24))))
  throw new Error("invalid_evidence_signature")
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)))
  .map(byte=>byte.toString(16).padStart(2,"0")).join("")
 const actor=await verifyOwnSession()
 if(actor!==uid)throw new Error("evidence_actor_changed")
 const path=uid+"/promotion/"+crypto.randomUUID()+"."+ext
 const db=supabase()
 const {error:uploadError}=await db.storage.from("work-media").upload(path,file,{
  contentType:file.type,upsert:false
 })
 if(uploadError)throw new Error("evidence_upload_failed")
 // On timeout, the RPC may already have committed. Never delete the image
 // or automatically retry creating a second evidence. User must refresh.
 const {data,error}=await db.rpc("upt_submit_promotion_evidence",{
  p_assignment:assignmentId,p_storage_path:path,p_sha256:hash
 })
 if(error||typeof data!=="string")throw new Error("evidence_confirmation_uncertain")
 return requireUuid(data)
}
export async function reviewPromotionEvidence(id:string,verdict:EvidenceVerdict,reason:string):Promise<void>{
 requireUuid(id)
 if(!["verified","rejected","inconclusive"].includes(verdict))throw new Error("invalid_verdict")
 const clean=validReviewReason(reason)
 await verifyOwnSession()
 const {error}=await supabase().rpc("upt_admin_review_promotion_evidence",{
  p_evidence:id,p_status:verdict,p_details:clean
 })
 if(error)throw new Error("evidence_review_unconfirmed")
}
