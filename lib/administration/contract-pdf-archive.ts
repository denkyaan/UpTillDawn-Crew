import "server-only"
import type {ContractDocument} from "./contract-document"
import {buildContractPdfManifest,encodeContractPdfManifest} from "./contract-pdf-manifest"
import {uploadContractArchive,type ArchiveStorageClient} from "./contract-archive-server"
import type {ContractArchiveDocumentType} from "./contract-archive"

/** Archive a supplied real PDF and its provenance manifest.
 * Requires a storage client with independently authorized write permissions.
 * No fake PDF conversion, signing, or automatic dispatch is performed here.
 */
export async function archiveApprovedContractPdf(input:{
 document:ContractDocument
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 pdf:Uint8Array
 client:ArchiveStorageClient
}):Promise<{pdfPath:string;manifestPath:string;sourceSha256:string;pdfSha256:string}>{
 const {document,documentType,documentId,version,pdf,client}=input
 if(document.reference!==documentType+"-"+documentId+"-v"+version)throw new Error("Contract reference mismatch")
 if(document.status!=="draft_for_signature")throw new Error("Invalid contract status")
 const manifest=await buildContractPdfManifest(document,pdf)
 const archivedPdf=await uploadContractArchive({documentType,documentId,version,kind:"draft",bytes:pdf,client})
 if(archivedPdf.sha256!==manifest.pdfSha256)throw new Error("Contract PDF digest mismatch")
 const archivedManifest=await uploadContractArchive({
  documentType,documentId,version,kind:"evidence",bytes:encodeContractPdfManifest(manifest),client
 })
 return {
  pdfPath:archivedPdf.path,
  manifestPath:archivedManifest.path,
  sourceSha256:manifest.sourceSha256,
  pdfSha256:manifest.pdfSha256
 }
}
