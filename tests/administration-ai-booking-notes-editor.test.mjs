import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const chat=readFileSync("components/administration/administration-ai-chat.tsx","utf8")
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
const route=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
test("administration AI exposes explicit confirmed booking note workflow",()=>{
 assert.match(chat,/<AdministrationAiBookingNotes locale=\{locale\} initialBookingId=\{initialBookingId\}\/>/)
 assert.match(editor,/confirmed:true/)
 assert.match(editor,/expectedNotes:booking\.internal_notes/)
 assert.match(editor,/booking\.status==="cancelled"/)
 assert.match(editor,/if\(response\.status===409\)\{setConflict\(true\)/)
 assert.match(editor,/if\(!response\.ok\)\{setFeedback\(t\.error\)/)
})
test("booking note preview requires access and reads only safe fields",()=>{
 assert.match(route,/export async function GET/)
 assert.match(route,/canOpenPortal\("administration"/)
 assert.match(route,/select\("id,artist_name,status,internal_notes"\)/)
})
