import "server-only"
import {authorizedContractStorage} from "./contract-archive-access"
import {authorizedSigningLedger} from "./contract-signing-supabase"
import {getContractSigningStatus} from "./documenso-envelope"
import {recoverSignedContractArchive} from "./contract-signing-recovery"
import type {ContractArchiveDocumentType} from "./contract-archive"

/**
 * Authenticated recovery. The caller must have verified the immutable
 * approved agreement version before invoking this operation.
 */
export async function recoverApprovedSignedContract(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 approvedVersionVerified:boolean
}){
 if(!input.approvedVersionVerified)throw new Error("Approved version required")
 const ledger=await authorizedSigningLedger()
 const record=await ledger.load(input)
 if(!record)throw new Error("Signing request not accessible")
 if(!record.envelopeId)throw new Error("Signing envelope missing")
 const remote=await getContractSigningStatus(record.envelopeId)
 if(remote.id!==record.envelopeId||remote.status!=="COMPLETED"){
  throw new Error("Signed contract recovery requires verified remote completion")
 }
 const client=await authorizedContractStorage()
 return recoverSignedContractArchive({
  record,ledger,client,approvedVersionVerified:true
 })
}
