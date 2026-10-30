import "server-only"
import type {ContractDocument} from "./contract-document"
import {renderContractPrintHtml} from "./contract-print"
import {archiveApprovedContractPdf} from "./contract-pdf-archive"
import {verifyArchivedContractPdf} from "./contract-archive-verify"
import type {ArchiveStorageClient} from "./contract-archive-server"
import type {ContractArchiveDocumentType} from "./contract-archive"

/** Trusted renderer must produce a genuine PDF, never an HTML file with a .pdf extension. */
export type ContractPdfRenderer=(html:string)=>Promise<Uint8Array>

/**
 * One coordinated operation: approved source -> HTML -> PDF -> private archive
 * -> read-back integrity verification. Requires independently authorized
 * storage write/read access and an explicitly configured PDF renderer.
 * No email, signing or recipient notification occurs.
 */
export async function generateAndArchiveContract(input:{
 document:ContractDocument
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 renderer:ContractPdfRenderer
 client:ArchiveStorageClient
}){
 const {document,documentType,documentId,version,renderer,client}=input
 if(document.reference!==documentType+"-"+documentId+"-v"+version)throw new Error("Contract identity mismatch")
 if(!document.approvedAt||typeof document.approvedAt!=="string"||!Number.isFinite(Date.parse(document.approvedAt)))throw new Error("Contract approval required")
 const html=renderContractPrintHtml(document)
 const pdf=await renderer(html)
 if(!(pdf instanceof Uint8Array))throw new Error("PDF renderer returned invalid output")
 const archived=await archiveApprovedContractPdf({document,documentType,documentId,version,pdf,client})
 await verifyArchivedContractPdf({
  document,pdfPath:archived.pdfPath,manifestPath:archived.manifestPath,client
 })
 return archived
}
