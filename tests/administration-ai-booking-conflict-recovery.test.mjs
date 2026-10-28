import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
const proposal=readFileSync("app/api/administration/assistant/booking-notes/propose/route.ts","utf8")
test("booking editor exposes recovery after optimistic concurrency conflict",()=>{
 assert.match(ui,/response\.status===409/)
 assert.match(ui,/setConflict\(true\)/)
 assert.match(ui,/conflict&&<div role="alert"/)
 assert.match(ui,/void load\(booking\.id\)/)
 assert.match(ui,/busy\|\|conflict\|\|notes===editableNotes/)
})
test("booking editor can discard draft and proposal reports no changes",()=>{
 assert.match(ui,/setNotes\(editableNotes\(booking\.internal_notes\)\)/)
 assert.match(ui,/payload\.unchanged\?t\.unchanged:t\.proposed/)
 assert.match(proposal,/unchanged:true/)
 assert.match(proposal,/unchanged:false/)
})
