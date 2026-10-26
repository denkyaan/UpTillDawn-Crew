import "server-only"
import {uploadContractArchive,downloadContractArchive,type ArchiveStorageClient} from "./contract-archive-server"
import type {ContractArchiveDocumentType} from "./contract-archive"

/** Archive a completed, independently verified signed PDF; never trust a webhook alone. */
export async function archiveCompletedSignedContract(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 envelopeId:string
 remoteStatus:"COMPLETED"
 signedPdf:Uint8Array
 client:ArchiveStorageClient
}):Promise<{path:string;sha256:string}>{
 if(input.remoteStatus!=="COMPLETED")throw new Error("Signed contract not completed")
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.envelopeId))throw new Error("Invalid envelope ID")
 const result=await uploadContractArchive({
  documentType:input.documentType,documentId:input.documentId,
  version:input.version,kind:"signed",bytes:input.signedPdf,client:input.client
 })
 await downloadContractArchive(result.path,input.client)
 return result
}
