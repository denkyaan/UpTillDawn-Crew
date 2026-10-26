import "server-only"
import {CONTRACT_ARCHIVE_BUCKET,contractArchivePath,isContractArchivePath,type ContractArchiveDocumentType,type ContractArchiveKind} from "./contract-archive"

/** Privileged storage operations: call only after independent administration authorization. */
type ArchiveStorageClient={
 storage:{from(bucket:string):{
  upload(path:string,bytes:Uint8Array,options:{contentType:string;upsert:boolean;cacheControl:string}):Promise<{error:unknown}>
  download(path:string):Promise<{data:Blob|null;error:unknown}>
 }}
}
/** Inject an authorized server-side storage client; never embed privileged keys here. */

async function digestHex(bytes:Uint8Array):Promise<string>{
 const hash=await crypto.subtle.digest("SHA-256",bytes)
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")
}
export async function uploadContractArchive(input:{
 documentType:ContractArchiveDocumentType
 documentId:string
 version:number
 kind:ContractArchiveKind
 bytes:Uint8Array
 client:ArchiveStorageClient
}):Promise<{path:string;sha256:string}>{
 const {bytes,kind,client}=input
 if(bytes.byteLength===0||bytes.byteLength>15*1024*1024)throw new Error("Contract archive file size invalid")
 const magic=Array.from(bytes.slice(0,5)).map(b=>String.fromCharCode(b)).join("")
 if(kind!=="evidence"&&magic!=="%PDF-")throw new Error("Contract archive requires a PDF")
 if(kind==="evidence"){
  try{JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}catch{throw new Error("Contract evidence requires valid JSON")}
 }
 const sha256=await digestHex(bytes)
 const path=contractArchivePath({...input,sha256})
 const {error}=await client.storage.from(CONTRACT_ARCHIVE_BUCKET).upload(path,bytes,{
  contentType:kind==="evidence"?"application/json":"application/pdf",
  upsert:false,
  cacheControl:"0"
 })
 if(error)throw new Error("Contract archive upload failed")
 return {path,sha256}
}
export async function downloadContractArchive(path:string,client:ArchiveStorageClient):Promise<Uint8Array>{
 if(!isContractArchivePath(path))throw new Error("Invalid contract archive path")
 const {data,error}=await client.storage.from(CONTRACT_ARCHIVE_BUCKET).download(path)
 if(error||!data)throw new Error("Contract archive download failed")
 const bytes=new Uint8Array(await data.arrayBuffer())
 const expected=path.split("/").at(-1)?.match(/-([a-f0-9]{64})\.(pdf|json)$/)?.[1]
 if(!expected||await digestHex(bytes)!==expected)throw new Error("Contract archive integrity check failed")
 return bytes
}
