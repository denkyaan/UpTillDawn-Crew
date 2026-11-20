import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("manual booking ID is edited locally without fetching on each keystroke",()=>{
 assert.match(ui,/const \[manualId,setManualId\]=useState\(initialBookingId\?\?""\)/)
 assert.match(ui,/value=\{manualId\} onChange=\{event=>setManualId\(event\.target\.value\)\}/)
 assert.doesNotMatch(ui,/value=\{id\} onChange=\{event=>chooseBooking\(event\.target\.value\)\}/)
 assert.match(ui,/if\(mayLeave\(\)\)\{setId\(manualId\);void load\(manualId\)\}/)
})
test("manual ID validates UUID and preserves unsaved draft until explicit load",()=>{
 assert.match(ui,/test\(manualId\)/)
 assert.match(ui,/setFeedback\(t\.error\);return/)
 assert.match(ui,/window\.confirm\(t\.leave\)/)
 assert.match(ui,/setManualId\(targetId\)/)
})
