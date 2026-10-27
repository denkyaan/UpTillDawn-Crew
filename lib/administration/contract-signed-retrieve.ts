import "server-only"
import {getDocumensoConfig} from "./documenso"
import {getContractSigningStatus} from "./documenso-envelope"
import {archiveCompletedSignedContract} from "./contract-signed-archive"
import type {ArchiveStorageClient} from "./contract-archive-server"
import type {ContractArchiveDocumentType} from "./contract-archive"

/**
 * Signed PDF retrieval is permitted only after checking Documenso's current
 * envelope state. The caller must independently authorize and bind the
 * envelope ID to an approved, immutable local contract version.
 */
export async function retrieveAndArchiveSignedContract(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 persistedEnvelopeId:string
 approvedVersionVerified:boolean
 client:ArchiveStorageClient
}){
 if(!input.approvedVersionVerified)throw new Error("Approved contract version not verified")
 const remote=await getContractSigningStatus(input.persistedEnvelopeId)
 if(remote.id!==input.persistedEnvelopeId||remote.status!=="COMPLETED"){
  throw new Error("Contract signature not complete")
 }
 const config=getDocumensoConfig()
 if(!config)throw new Error("Documenso not configured")
 const response=await fetch(
  config.baseUrl+"/api/v2/envelope/download/"+encodeURIComponent(input.persistedEnvelopeId),
  {headers:{Authorization:config.apiKey,Accept:"application/pdf"},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000)}
 )
 if(!response.ok||!response.headers.get("content-type")?.includes("application/pdf")){
  throw new Error("Signed PDF retrieval failed")
 }
 const size=Number(response.headers.get("content-length")??"0")
 if(size>15*1024*1024)throw new Error("Signed PDF exceeds size limit")
 const reader=response.body?.getReader()
 if(!reader)throw new Error("Signed PDF response is empty")
 const chunks:Uint8Array[]=[]
 let total=0
 try{
  while(true){
   const next=await reader.read()
   if(next.done)break
   total+=next.value.byteLength
   if(total>15*1024*1024)throw new Error("Signed PDF exceeds size limit")
   chunks.push(next.value)
  }
 }finally{reader.releaseLock()}
 if(total<5)throw new Error("Signed PDF response too short")
 const pdf=new Uint8Array(total)
 let offset=0
 for(const chunk of chunks){pdf.set(chunk,offset);offset+=chunk.length}
 if(new TextDecoder().decode(pdf.slice(0,5))!=="%PDF-")throw new Error("Invalid signed PDF header")
 return archiveCompletedSignedContract({
  documentType:input.documentType,documentId:input.documentId,
  version:input.version,envelopeId:input.persistedEnvelopeId,
  remoteStatus:"COMPLETED",signedPdf:pdf,client:input.client
 })
}
