import "server-only"
import {createClient} from "@/lib/supabase/crew-server"
import {authorizedContractStorage} from "./contract-archive-access"
import {createSigningLedger,type SigningLedgerStore} from "./contract-signing-ledger-adapter"
import type {SigningRecord} from "./contract-signing-ledger"
import type {ContractSigningState} from "./contract-signing-status"

const TABLE="administration_contract_signing_requests" as const
// Table introduced after the current generated Database types. Restrict
// the temporary cast to this table until the schema types are regenerated.
type SigningRow={
 document_type:"artist"|"staff"
 document_id:string
 document_version:number
 document_sha256:string
 envelope_id:string|null
 status:ContractSigningState
 signed_pdf_path:string|null
}
const map=(row:SigningRow):SigningRecord=>{
 if(!["artist","staff"].includes(row.document_type)||
  !/^[0-9a-f-]{36}$/i.test(row.document_id)||
  !Number.isSafeInteger(row.document_version)||row.document_version<1||
  !/^[a-f0-9]{64}$/.test(row.document_sha256)||
  !["draft","sent","completed","rejected","cancelled"].includes(row.status)||
  (row.envelope_id!==null&&!/^[A-Za-z0-9_-]{1,128}$/.test(row.envelope_id))){
  throw new Error("Invalid signing ledger record")
 }
 return ({
 documentType:row.document_type,documentId:row.document_id,
 version:row.document_version,sourceSha256:row.document_sha256,
 envelopeId:row.envelope_id,state:row.status,signedPdfPath:row.signed_pdf_path
})

/**
 * Uses the authenticated session only. The signing ledger currently has
 * default-deny RLS; operations will fail closed until a reviewed database
 * authorization path is deployed. No privileged API key is embedded.
 */
export async function authorizedSigningLedger(){
 await authorizedContractStorage()
 const db=await createClient()
 const table=()=>db.from(TABLE as never) as ReturnType<typeof db.from> 
 const store:SigningLedgerStore={
  async find(documentType,documentId,version){
   const {data,error}=await table().select(
    "document_type,document_id,document_version,document_sha256,envelope_id,status,signed_pdf_path"
   ).eq("document_type",documentType).eq("document_id",documentId)
    .eq("document_version",version).maybeSingle()
   if(error)throw new Error("Signing ledger read denied")
   return data?map(data as SigningRow):null
  },
  async attach(input){
   const {data,error}=await table().update({envelope_id:input.envelopeId,updated_at:new Date().toISOString()})
    .eq("document_type",input.documentType).eq("document_id",input.documentId)
    .eq("document_version",input.version).eq("document_sha256",input.sourceSha256)
    .is("envelope_id",null).eq("status","draft").select("id")
   if(error)throw new Error("Signing envelope attachment denied")
   return data?.length??0
  },
  async change(input){
   const changes:Record<string,string>={status:input.nextState,updated_at:new Date().toISOString()}
   if(input.nextState==="completed")changes.completed_at=new Date().toISOString()
   if(input.nextState==="sent")changes.dispatched_at=new Date().toISOString()
   const {data,error}=await table().update(changes)
    .eq("envelope_id",input.envelopeId).eq("status",input.expectedState).select("id")
   if(error)throw new Error("Signing state transition denied")
   return data?.length??0
  },
  async saveSignedPdf(envelopeId,path){
   const {data,error}=await table().update({
    signed_pdf_path:path,updated_at:new Date().toISOString()
   }).eq("envelope_id",envelopeId).eq("status","completed")
    .is("signed_pdf_path",null).select("id")
   if(error)throw new Error("Signed PDF ledger update denied")
   return data?.length??0
  }
 }
 return createSigningLedger(store)
}
