import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {authorizedContractStorage} from "./contract-archive-access"

/** Prepares a single approved artist version without sending any email. */
export async function prepareApprovedArtistSigning(input:{
 agreementVersionId:string
 version:number
 sourceSha256:string
 recipientEmail:string
}):Promise<string>{
 await authorizedContractStorage()
 if(!/^[0-9a-f-]{36}$/i.test(input.agreementVersionId)||
  !Number.isSafeInteger(input.version)||input.version<1||
  !/^[a-f0-9]{64}$/.test(input.sourceSha256)||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail)){
  throw new Error("Invalid signing preparation")
 }
 const db=await createClient()
 // The RPC is introduced in the newest migration; generated types lag behind.
 const rpc=db.rpc as unknown as (name:string,args:Record<string,unknown>)=>Promise<{
  data:unknown;error:{message:string}|null
 }>
 const {data,error}=await rpc("upt_prepare_artist_contract_signing",{
  p_version_id:input.agreementVersionId,p_version:input.version,
  p_source_sha256:input.sourceSha256,p_recipient_email:input.recipientEmail
 })
 if(error||typeof data!=="string"||!/^[0-9a-f-]{36}$/i.test(data)){
  throw new Error("Signing preparation denied or unavailable")
 }
 return data
}
