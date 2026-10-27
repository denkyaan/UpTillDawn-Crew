import "server-only"
import type {SigningLedger,SigningRecord} from "./contract-signing-ledger"
import {retrieveAndArchiveSignedContract} from "./contract-signed-retrieve"
import {downloadContractArchive} from "./contract-archive-server"
import {getContractSigningStatus} from "./documenso-envelope"
import {contractArchivePath} from "./contract-archive"
import type {ArchiveStorageClient} from "./contract-archive-server"

/**
 * Recovery after a completed signature: if the archive path is missing,
 * download again and store it. A unique immutable object name prevents
 * silent replacement. Ledger write is conditional on the stored envelope.
 */
export async function recoverSignedContractArchive(input:{
 record:SigningRecord
 ledger:SigningLedger
 client:ArchiveStorageClient
 approvedVersionVerified:boolean
}):Promise<{path:string;recovered:boolean}>{
 const {record,ledger,client}=input
 if(record.state!=="completed"||!record.envelopeId)throw new Error("Contract not completed")
 if(!input.approvedVersionVerified)throw new Error("Approved version required")
 if(record.signedPdfPath){
  const prefix=record.documentType+"/"+record.documentId+"/v"+record.version+"/"
  if(!record.signedPdfPath.startsWith(prefix+"signed-"))throw new Error("Signed PDF path does not match approved version")
  const remote=await getContractSigningStatus(record.envelopeId)
  if(remote.id!==record.envelopeId||remote.status!=="COMPLETED")throw new Error("Remote signature completion not verified")
  const bytes=await downloadContractArchive(record.signedPdfPath,client)
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("")
  if(record.signedPdfPath!==contractArchivePath({
   documentType:record.documentType,documentId:record.documentId,
   version:record.version,kind:"signed",sha256:digest
  }))throw new Error("Signed PDF archive identity mismatch")
  return {path:record.signedPdfPath,recovered:false}
 }
 const latest=await ledger.load({documentType:record.documentType,documentId:record.documentId,version:record.version})
 if(!latest||latest.envelopeId!==record.envelopeId||latest.sourceSha256!==record.sourceSha256||latest.state!=="completed")throw new Error("Stale signing record")
 if(latest.signedPdfPath)throw new Error("Signed PDF already recorded")
 const archive=await retrieveAndArchiveSignedContract({
  documentType:record.documentType,documentId:record.documentId,
  version:record.version,persistedEnvelopeId:record.envelopeId,
  approvedVersionVerified:input.approvedVersionVerified,client
 })
 const saved=await ledger.recordSignedPdf({envelopeId:record.envelopeId,path:archive.path})
 if(!saved)throw new Error("Signed PDF archived but ledger update requires reconciliation")
 return {path:archive.path,recovered:true}
}
