import type {ContractDocument} from "./contract-document"

/**
 * Stable UTF-8 bytes for a contract version. The digest binds every field of
 * the approved contract payload to its archived/signature counterpart.
 */
export function canonicalContractBytes(document:ContractDocument):Uint8Array{
 const ordered={
  schemaVersion:document.schemaVersion,
  reference:document.reference,
  title:document.title,
  parties:{
   issuer:{name:document.parties.issuer.name,email:document.parties.issuer.email,country:document.parties.issuer.country??null},
   recipient:{name:document.parties.recipient.name,email:document.parties.recipient.email,country:document.parties.recipient.country??null}
  },
  event:{name:document.event.name,date:document.event.date},
  clauses:document.clauses.map(c=>({heading:c.heading,body:c.body})),
  approvedAt:document.approvedAt,
  status:document.status
 }
 return new TextEncoder().encode(JSON.stringify(ordered))
}
export async function contractSha256(document:ContractDocument):Promise<string>{
 const digest=await crypto.subtle.digest("SHA-256",canonicalContractBytes(document))
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")
}
