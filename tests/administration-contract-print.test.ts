import assert from "node:assert/strict"
import {test} from "node:test"
import {buildContractDocument} from "../lib/administration/contract-document"
import {renderContractPrintHtml} from "../lib/administration/contract-print"

const input={
 documentId:"123e4567-e89b-42d3-a456-426614174000",
 documentType:"staff" as const,
 version:2,
 eventName:"Up Till Dawn",
 eventDate:"2026-11-15T22:00:00Z",
 issuer:{name:"Up Till Dawn",email:"team@example.com"},
 recipient:{name:"Alex <script>alert(1)</script>",email:"alex@example.com"},
 terms:{duties:"Staff duties & responsibilities"},
 approvedAt:"2026-10-26T16:00:00Z"
}
test("printable contract uses A4 and escapes untrusted input",()=>{
 const html=renderContractPrintHtml(buildContractDocument(input))
 assert.match(html,/@page\{size:A4/)
 assert.match(html,/Alex &lt;script&gt;/)
 assert.doesNotMatch(html,/<script>/)
 assert.match(html,/Staff duties &amp; responsibilities/)
 assert.match(html,/Not yet signed/)
})
