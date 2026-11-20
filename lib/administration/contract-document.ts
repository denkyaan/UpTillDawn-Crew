/**
 * Deterministic, read-only contract document payloads.
 * PDF rendering and dispatch are intentionally separate, audited operations.
 */
export type ContractParty = {
 name:string
 email:string
 country?:string|null
}
export type ContractDocumentInput = {
 documentId:string
 documentType:"artist"|"staff"
 version:number
 eventName:string
 eventDate:string
 issuer:ContractParty
 recipient:ContractParty
 terms:Readonly<Record<string,string>>
 approvedAt:string
}
export type ContractDocument = {
 schemaVersion:1
 reference:string
 title:string
 parties:{issuer:ContractParty;recipient:ContractParty}
 event:{name:string;date:string}
 clauses:ReadonlyArray<{heading:string;body:string}>
 approvedAt:string
 status:"draft_for_signature"
}
const clean=(value:string,max:number)=>{
 const normalized=value.trim().replace(/\s+/g," ")
 if(!normalized||normalized.length>max)throw new Error("Invalid contract field")
 return normalized
}
export function buildContractDocument(input:ContractDocumentInput):ContractDocument{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.documentId))throw new Error("Invalid contract ID")
 if(!Number.isSafeInteger(input.version)||input.version<1)throw new Error("Invalid contract version")
 if(!input.approvedAt?.trim()||!input.eventDate?.trim()||!Number.isFinite(Date.parse(input.approvedAt))||!Number.isFinite(Date.parse(input.eventDate)))throw new Error("Invalid contract dates")
 if(Date.parse(input.approvedAt)>Date.now()+60_000)throw new Error("Contract approval cannot be in the future")
 const party=(value:ContractParty):ContractParty=>({
  name:clean(value.name,240),
  email:(()=>{const email=clean(value.email,320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Invalid contract party email");return email})(),
  country:value.country?clean(value.country,100):null
 })
 const clauses=Object.entries(input.terms).sort(([a],[b])=>a.localeCompare(b)).map(([heading,body])=>({
  heading:clean(heading,120),body:clean(body,10000)
 }))
 if(clauses.length===0)throw new Error("Contract clauses required")
 return {
  schemaVersion:1,
  reference:input.documentType+"-"+input.documentId+"-v"+input.version,
  title:input.documentType==="artist"?"Artist performance agreement":"Staff engagement agreement",
  parties:{issuer:party(input.issuer),recipient:party(input.recipient)},
  event:{name:clean(input.eventName,240),date:input.eventDate},
  clauses,
  approvedAt:input.approvedAt,
  status:"draft_for_signature"
 }
}
