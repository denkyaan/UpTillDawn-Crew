import "server-only"
import type {ContractDocument} from "./contract-document"
import type {SigningLedger} from "./contract-signing-ledger"
import type {ArchiveStorageClient} from "./contract-archive-server"
import {downloadContractArchive} from "./contract-archive-server"
import {verifyArchivedContractPdf} from "./contract-archive-verify"
import {contractSha256} from "./contract-integrity"
import {dispatchApprovedSigningEnvelope} from "./contract-signing-dispatch"

/**
 * Server-only archive-to-dispatch boundary.
 * The caller MUST independently verify user authorization, approval from the
 * database, and that the document was built from that immutable snapshot.
 * Never trust client-supplied paths or approval flags.
 */
export async function dispatchArchivedApprovedContract(input:{
 document:ContractDocument
 documentType:"artist"|"staff"
 documentId:string
 version:number
 pdfPath:string
 manifestPath:string
 recipientEmail:string
 client:ArchiveStorageClient
 ledger:SigningLedger
 confirmedByOperator:boolean
 approvalVerified:boolean
}):Promise<"sent"|"already_sent">{
 if(!input.approvalVerified)throw new Error("Database approval required")
 if(!input.confirmedByOperator)throw new Error("Explicit operator confirmation required")
 if(input.document.reference!==input.documentType+"-"+input.documentId+"-v"+input.version){
  throw new Error("Approved contract identity mismatch")
 }
 const record=await input.ledger.load({
  documentType:input.documentType,documentId:input.documentId,version:input.version
 })
 if(!record)throw new Error("Signing ledger entry missing")
 const sourceHash=await contractSha256(input.document)
 if(record.sourceSha256!==sourceHash)throw new Error("Approved contract digest mismatch")
 await verifyArchivedContractPdf({
  document:input.document,pdfPath:input.pdfPath,
  manifestPath:input.manifestPath,client:input.client
 })
 const pdf=await downloadContractArchive(input.pdfPath,input.client)
 return dispatchApprovedSigningEnvelope({
  document:input.document,record,pdf,
  recipientEmail:input.recipientEmail,ledger:input.ledger,
  confirmedByOperator:input.confirmedByOperator
 })
}
