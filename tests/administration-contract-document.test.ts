import assert from "node:assert/strict"
import {test} from "node:test"
import {buildContractDocument} from "../lib/administration/contract-document"

const example={
 documentId:"123e4567-e89b-42d3-a456-426614174000",
 documentType:"artist" as const,
 version:1,
 eventName:"Up Till Dawn",
 eventDate:"2026-11-15T22:00:00Z",
 issuer:{name:"Up Till Dawn",email:"contracts@example.com"},
 recipient:{name:"Guest Artist",email:"artist@example.com"},
 terms:{payment:"Payment due on agreed date",cancellation:"Cancellation requires notice"},
 approvedAt:"2026-10-26T16:00:00Z"
}
test("contract payload preserves approved immutable details",()=>{
 const result=buildContractDocument(example)
 assert.equal(result.reference,"artist-"+example.documentId+"-v1")
 assert.equal(result.clauses.length,2)
 assert.equal(result.status,"draft_for_signature")
 assert.equal(result.parties.recipient.email,example.recipient.email)
})
test("staff contracts use the same document model",()=>{
 assert.equal(buildContractDocument({...example,documentType:"staff"}).title,"Staff engagement agreement")
})
test("empty contract terms cannot generate a document",()=>{
 assert.throws(()=>buildContractDocument({...example,terms:{}}))
})
