import "server-only"
import type {ContractDocument} from "./contract-document"
import {buildContractPdfManifest,type ContractPdfManifest} from "./contract-pdf-manifest"
import {downloadContractArchive,type ArchiveStorageClient} from "./contract-archive-server"

/** Verify both archived objects against the current immutable approved payload. */
export async function verifyArchivedContractPdf(input:{
 document:ContractDocument
 pdfPath:string
 manifestPath:string
 client:ArchiveStorageClient
}):Promise<{valid:true;manifest:ContractPdfManifest}>{
 const {document,pdfPath,manifestPath,client}=input
 if(!pdfPath.endsWith(".pdf")||!manifestPath.endsWith(".json"))throw new Error("Invalid archive file types")
 const prefix=document.reference.replace(/^(artist|staff)-([0-9a-f-]{36})-v([1-9][0-9]*)$/i,(_match,type:string,id:string,version:string)=>type+"/"+id+"/v"+version+"/")
 if(prefix===document.reference||!pdfPath.startsWith(prefix+"draft-")||!manifestPath.startsWith(prefix+"evidence-")){
  throw new Error("Contract archive version mismatch")
 }
 if(!/^(artist|staff)\/[0-9a-f-]{36}\/v[1-9][0-9]*\/draft-[a-f0-9]{64}\.pdf$/.test(pdfPath))throw new Error("Invalid PDF archive identity")
 const pdf=await downloadContractArchive(pdfPath,client)
 const evidence=await downloadContractArchive(manifestPath,client)
 let manifest:unknown
 try{manifest=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(evidence))}catch{throw new Error("Invalid contract archive manifest")}
 const expected=await buildContractPdfManifest(document,pdf)
 const actual=manifest as Partial<ContractPdfManifest>|null
 if(!actual||typeof actual!=="object"||
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
