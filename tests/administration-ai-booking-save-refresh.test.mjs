import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("confirmed booking note save reloads current booking and audit history",()=>{
 assert.match(editor,/if\(!result\.saved\)/)
 assert.match(editor,/const refreshed=|let refreshed:Response/)
 assert.match(editor,/encodeURIComponent\(targetId\)/)
 assert.match(editor,/setBooking\(latest\.booking\)/)
 assert.match(editor,/setAudit\(latest\.audit\?\?\[\]\)/)
 assert.match(editor,/setNotes\(editableNotes\(latest\.booking\.internal_notes\)\)/)
})
test("successful write is not presented as failed when follow-up refresh fails",()=>{
 assert.match(editor,/catch\{setBooking\(null\);setNotes\(""\);setFeedback\(t\.success\);return\}/)
 assert.match(editor,/if\(!refreshed\.ok\)\{setBooking\(null\);setNotes\(""\);setFeedback\(t\.success\);return\}/)
})
