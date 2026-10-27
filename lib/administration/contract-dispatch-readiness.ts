import type {SigningRecord} from "./contract-signing-ledger"
import type {ContractDocument} from "./contract-document"
import {contractSha256} from "./contract-integrity"

export type DispatchReadiness={
 ready:boolean
 blockers:ReadonlyArray<"identity"|"approval"|"digest"|"recipient"|"envelope"|"state"|"pdf">
}

/** Pure fail-closed gate: a UI confirmation alone never authorizes delivery. */
export async function checkContractDispatchReadiness(input:{
 document:ContractDocument
 record:SigningRecord|null
 pdf:Uint8Array|null
 recipientEmail:string
}):Promise<DispatchReadiness>{
 const blockers:DispatchReadiness["blockers"][number][]=[]
 const {document,record,pdf}=input
 if(!record||document.reference!==record.documentType+"-"+record.documentId+"-v"+record.version)blockers.push("identity")
 const approvalTime=Date.parse(document.approvedAt)
 if(!Number.isFinite(approvalTime)||approvalTime>Date.now())blockers.push("approval")
 if(!record||await contractSha256(document)!==record.sourceSha256)blockers.push("digest")
 const recipient=input.recipientEmail.trim().toLowerCase()
 const approvedRecipient=document.parties.recipient.email.trim().toLowerCase()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||
  recipient!==approvedRecipient)blockers.push("recipient")
 if(!record?.envelopeId||!/^[a-zA-Z0-9_-]{1,128}$/.test(record.envelopeId))blockers.push("envelope")
 if(record?.state!=="draft"||record?.signedPdfPath!==null)blockers.push("state")
 if(!pdf||pdf.length<5||pdf.length>15*1024*1024||
  String.fromCharCode(...pdf.slice(0,5))!=="%PDF-")blockers.push("pdf")
 return {ready:blockers.length===0,blockers}
}
