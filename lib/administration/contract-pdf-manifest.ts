import type {ContractDocument} from "./contract-document"
import {canonicalContractBytes,contractSha256} from "./contract-integrity"

/** Immutable evidence manifest for a generated contract PDF.
 * The PDF file hash is independent from the canonical source-document hash.
 */
export type ContractPdfManifest={
 schemaVersion:1
 reference:string
 sourceSha256:string
 pdfSha256:string
 pdfSize:number
 approvedAt:string
}
export async function buildContractPdfManifest(document:ContractDocument,pdf:Uint8Array):Promise<ContractPdfManifest>{
 if(pdf.byteLength===0||pdf.byteLength>15*1024*1024)throw new Error("Invalid contract PDF size")
 if(new TextDecoder().decode(pdf.slice(0,5))!=="%PDF-")throw new Error("Invalid contract PDF header")
 const pdfHash=await crypto.subtle.digest("SHA-256",pdf)
 const pdfSha256=Array.from(new Uint8Array(pdfHash),b=>b.toString(16).padStart(2,"0")).join("")
 return {
  schemaVersion:1,
  reference:document.reference,
  sourceSha256:await contractSha256(document),
  pdfSha256,
  pdfSize:pdf.byteLength,
  approvedAt:document.approvedAt
 }
}
export function encodeContractPdfManifest(manifest:ContractPdfManifest):Uint8Array{
 return new TextEncoder().encode(JSON.stringify(manifest))
}
