// Exact independent source-side artist agreement reads. The caller must
// authenticate the signed Supabase SSR session and check administration rights.
// Unlike a signed public URL, the archive is fetched by scoped Storage RLS,
// verified as a complete PDF and SHA-256 checked before responding.
import type {SupabaseClient} from "@supabase/supabase-js"
import {buildContractDocument} from "../../../lib/administration/contract-document.ts"
import {renderContractPrintHtml} from "../../../lib/administration/contract-print.ts"
import {contractSha256} from "../../../lib/administration/contract-integrity.ts"
import {isContractArchivePath,CONTRACT_ARCHIVE_BUCKET} from "../../../lib/administration/contract-archive.ts"

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const missing=()=>new Response("Not found",{status:404,headers:{"Cache-Control":"private, no-store"}})
const archiveUnavailable=()=>new Response("Contract archive unavailable",{status:404,headers:{"Cache-Control":"no-store"}})
async function readArchiveBytes(db:SupabaseClient,path:string):Promise<Uint8Array>{
 if(!isContractArchivePath(path))throw Error("Invalid contract archive path")
 const {data,error}=await db.storage.from(CONTRACT_ARCHIVE_BUCKET).download(path)
 if(error||!data)throw Error("Contract archive download failed")
 const bytes=new Uint8Array(await data.arrayBuffer())
 if(bytes.byteLength===0||bytes.byteLength>15*1024*1024)
  throw Error("Contract archive file size invalid")
 const body=new TextDecoder("latin1").decode(bytes.slice(-1024))
 if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-"||
  bytes.byteLength<10||!/%%EOF\s*$/.test(body))
  throw Error("Contract archive PDF invalid or incomplete")
 const hex=path.split("/").at(-1)?.match(/-([a-f0-9]{64})\.pdf$/)?.[1]
 if(!hex)throw Error("Invalid contract SHA")
 const actual=await crypto.subtle.digest("SHA-256",bytes)
 const sum=Array.from(new Uint8Array(actual),n=>n.toString(16).padStart(2,"0")).join("")
 if(hex!==sum)throw Error("Contract archive integrity check failed")
 return bytes
}
export async function nativeArtistContractArchive(
 db:SupabaseClient,request:Request,id:string,versionId:string
):Promise<Response>{
 if(!uuid.test(id)||!uuid.test(versionId))return missing()
 const {data:version,error}=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,approved_at")
  .eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(error||!version?.approved_at)return missing()
 const path=new URL(request.url).searchParams.get("path")
 if(!path||!isContractArchivePath(path))return missing()
 const prefix="artist/"+versionId+"/v"+version.version_number+"/"
 if(!path.startsWith(prefix)||!path.endsWith(".pdf"))return missing()
 try{
  const bytes=await readArchiveBytes(db,path)
  return new Response(Uint8Array.from(bytes).buffer,{headers:{
   "Content-Type":"application/pdf",
   "Content-Disposition":'attachment; filename="agreement-'+version.version_number+'.pdf"',
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
  }})
 }catch{return archiveUnavailable()}
}
export async function nativeArtistContractPrint(
 db:SupabaseClient,id:string,versionId:string,issuerEmail?:string
):Promise<Response>{
 if(!uuid.test(id)||!uuid.test(versionId))return missing()
 const {data:version,error}=await db.from("admin_artist_agreement_versions")
  .select("id,version_number,snapshot,approved_at")
  .eq("id",versionId).eq("booking_id",id).maybeSingle()
 if(error||!version?.approved_at)return missing()
 const snapshot:unknown=version.snapshot
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return missing()
 const values=snapshot as Record<string,unknown>
 const str=(key:string)=>typeof values[key]==="string"?values[key] as string:""
 const terms={
  payment:str("agreement_payment_terms"),
  cancellation:str("agreement_cancellation_terms"),
  liability:str("agreement_liability_terms"),
  governing_law:str("agreement_governing_law")
 }
 if(Object.values(terms).some(value=>!value))return missing()
 const fee=typeof values.fee_amount==="number"?values.fee_amount:null
 if(fee!==null)terms.payment+="\nAgreed fee: "+fee+" "+str("currency")
 try{
  const doc=buildContractDocument({
   documentId:version.id,documentType:"artist",version:version.version_number,
   eventName:str("event_name"),eventDate:str("event_start_at"),
   issuer:{name:"Up Till Dawn",email:issuerEmail??"contracts@uptilldawn.be"},
   recipient:{name:str("agency_name"),email:str("agency_email")},
   terms,approvedAt:version.approved_at
  })
  const digest=await contractSha256(doc)
  const html=renderContractPrintHtml(doc)
  return new Response(html,{headers:{
   "Content-Type":"text/html; charset=utf-8",
   "Cache-Control":"private, no-store",
   "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
   "X-Content-Type-Options":"nosniff","X-Contract-SHA256":digest,
   "Content-Disposition":'inline; filename="agreement-'+version.version_number+'.html"'
  }})
 }catch{return missing()}
}
