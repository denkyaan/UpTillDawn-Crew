import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking picker lists only authorized non-cancelled bookings and no sensitive fields",()=>{
 assert.match(route,/canOpenPortal\("administration"/)
 assert.match(route,/select\("id,artist_name,status"\)\.neq\("status","cancelled"\)/)
 assert.match(route,/pageSize=25/)
 assert.match(route,/\.range\(page\*pageSize,\(page\+1\)\*pageSize\)/)
 assert.match(route,/\.ilike\("artist_name"/)
 assert.match(route,/hasMore:\(data\?\?\[\]\)\.length>pageSize/)
})
test("booking picker uses explicit user selection and retains confirmation on save",()=>{
 assert.match(editor,/async function listBookings\(/)
 assert.match(editor,/choices\.map\(item=><option/)
 assert.match(editor,/void load\(event\.target\.value\)/)
 assert.match(editor,/confirmed:true/)
})
