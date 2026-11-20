import "server-only"
import type {ContractDocument} from "./contract-document"
import {buildContractPdfManifest,type ContractPdfManifest} from "./contract-pdf-manifest"
import {downloadContractArchive,type ArchiveStorageClient} from "./contract-archive-server"
import {isContractArchivePath} from "./contract-archive"

/** Verify both archived objects against the current immutable approved payload. */
export async function verifyArchivedContractPdf(input:{
 document:ContractDocument
 pdfPath:string
 manifestPath:string
 client:ArchiveStorageClient
}):Promise<{valid:true;manifest:ContractPdfManifest}>{
 const {document,pdfPath,manifestPath,client}=input
 if(!isContractArchivePath(pdfPath)||!isContractArchivePath(manifestPath)||!pdfPath.endsWith(".pdf")||!manifestPath.endsWith(".json"))throw new Error("Invalid archive file types")
 const prefix=document.reference.replace(/^(artist|staff)-([0-9a-f-]{36})-v([1-9][0-9]*)$/i,(_match,type:string,id:string,version:string)=>type+"/"+id+"/v"+version+"/")
 if(prefix===document.reference||!pdfPath.startsWith(prefix+"draft-")||!manifestPath.startsWith(prefix+"evidence-")){
  throw new Error("Contract archive version mismatch")
 }

 const pdf=await downloadContractArchive(pdfPath,client)
 const evidence=await downloadContractArchive(manifestPath,client)
 let manifest:unknown
 try{manifest=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(evidence))}catch{throw new Error("Invalid contract archive manifest")}
 const expected=await buildContractPdfManifest(document,pdf)
 const actual=manifest as Partial<ContractPdfManifest>|null
 const pdfName=pdfPath.split("/").at(-1)
 if(pdfName!=="draft-"+expected.pdfSha256+".pdf")throw new Error("Archived PDF digest does not match manifest")
 // The evidence filename must be content-addressed too, not merely valid JSON.
 const evidenceHash=await crypto.subtle.digest("SHA-256",evidence)
 const evidenceSha256=Array.from(new Uint8Array(evidenceHash),b=>b.toString(16).padStart(2,"0")).join("")
 if(manifestPath.split("/").at(-1)!=="evidence-"+evidenceSha256+".json")throw new Error("Archived evidence digest mismatch")
 if(!actual||typeof actual!=="object"||Array.isArray(actual)||
  actual.schemaVersion!==expected.schemaVersion||
  actual.reference!==expected.reference||
  actual.sourceSha256!==expected.sourceSha256||
  actual.pdfSha256!==expected.pdfSha256||
  actual.pdfSize!==expected.pdfSize||
  actual.approvedAt!==expected.approvedAt){
  throw new Error("Contract archive manifest mismatch")
 }
 return {valid:true,manifest:expected}
}
