import assert from "node:assert/strict"
import {test} from "node:test"
import {buildContractDocument} from "../lib/administration/contract-document"
import {contractSha256,canonicalContractBytes} from "../lib/administration/contract-integrity"

const input={
 documentId:"123e4567-e89b-42d3-a456-426614174000",
 documentType:"artist" as const,
 version:1,
 eventName:"Up Till Dawn",
 eventDate:"2026-11-15T22:00:00Z",
 issuer:{name:"Up Till Dawn",email:"contracts@example.com"},
 recipient:{name:"Artist",email:"artist@example.com"},
 terms:{payment:"€1000",cancellation:"Written notice"},
 approvedAt:"2026-10-26T16:00:00Z"
}
test("approved contract fingerprint is stable and content sensitive",async()=>{
 const doc=buildContractDocument(input)
 const first=await contractSha256(doc)
 assert.match(first,/^[a-f0-9]{64}$/)
 assert.equal(first,await contractSha256(doc))
 assert.ok(canonicalContractBytes(doc).length>0)
 assert.notEqual(first,await contractSha256(buildContractDocument({...input,terms:{...input.terms,payment:"€1200"}})))
})
