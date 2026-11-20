import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const api=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
test("AI-assisted note writes require explicit confirmation and existing portal access",()=>{
 assert.match(api,/confirmed:z\.literal\(true\)/)
 assert.match(api,/canOpenPortal\("administration"/)
 assert.match(api,/sec-fetch-site/)
 assert.match(api,/expectedNotes/)
})
test("note edits cannot change financial booking fields or erase audit history",()=>{
 assert.match(api,/\.update\(\{internal_notes:newNotes\|\|null,updated_at:/)
 assert.match(api,/preserved=\(booking\.internal_notes/)
 assert.match(api,/status==="cancelled"/)
 assert.match(api,/status:409/)
 assert.doesNotMatch(api,/\.update\(\{[^}]*fee_amount/)
})
