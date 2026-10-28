import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/booking-notes/propose/route.ts","utf8")
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("AI proposals require matching booking snapshot before model call",()=>{
 assert.match(route,/expectedNotes:z\.string\(\)\.max\(5000\)\.nullable\(\)/)
 assert.match(route,/booking\.internal_notes!==parsed\.data\.expectedNotes/)
 assert.ok(route.indexOf("booking.internal_notes!==parsed.data.expectedNotes")<route.indexOf("ai.run("))
})
test("AI proposals recheck booking after generation and return conflict for concurrent changes",()=>{
 assert.match(route,/const \{data:latest,error:latestError\}/)
 assert.match(route,/latest\.status==="cancelled"/)
 assert.match(route,/latest\.internal_notes!==parsed\.data\.expectedNotes/)
 assert.match(route,/Booking changed during AI generation/)
 assert.match(editor,/bookingId:booking\.id,expectedNotes:booking\.internal_notes,instruction,locale/)
 assert.match(editor,/if\(response\.status===409\)\{setConflict\(true\)/)
})
