import "server-only"
import type {SigningLedger,SigningRecord} from "./contract-signing-ledger"
import {retrieveAndArchiveSignedContract} from "./contract-signed-retrieve"
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
 if(record.signedPdfPath)return {path:record.signedPdfPath,recovered:false}
 const archive=await retrieveAndArchiveSignedContract({
  documentType:record.documentType,documentId:record.documentId,
  version:record.version,persistedEnvelopeId:record.envelopeId,
  approvedVersionVerified:input.approvedVersionVerified,client
 })
 const saved=await ledger.recordSignedPdf({envelopeId:record.envelopeId,path:archive.path})
 if(!saved)throw new Error("Signed PDF archived but ledger update requires reconciliation")
 return {path:archive.path,recovered:true}
}
