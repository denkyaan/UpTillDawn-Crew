import "server-only"
import type {ContractDocument} from "./contract-document"
import type {ContractArchiveDocumentType} from "./contract-archive"
import {createContractPdfRenderer} from "./contract-pdf-renderer"
import {generateAndArchiveContract} from "./contract-generation-pipeline"
import {authorizedContractStorage} from "./contract-archive-access"

/**
 * Operational entry point. The caller MUST load the immutable approved
 * contract version from the database and verify it belongs to this document.
 * Storage RLS independently decides whether this session may write objects.
 */
export async function renderAndArchiveApprovedContract(input:{
 document:ContractDocument
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 approvalVerified:boolean
}){
 if(input.approvalVerified!==true)throw new Error("Contract approval not verified")
 const client=await authorizedContractStorage()
 const renderer=createContractPdfRenderer()
 return generateAndArchiveContract({...input,client,renderer})
}
