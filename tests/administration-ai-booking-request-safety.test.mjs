import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking requests ignore stale load and AI proposal responses",()=>{
 assert.match(ui,/const requestRef=useRef\(0\)/)
 assert.match(ui,/const requestId=\+\+requestRef\.current/)
 assert.match(ui,/selectionRef\.current!==targetId\|\|requestRef\.current!==requestId/)
 assert.match(ui,/if\(busyRef\.current\|\|busy\|\|targetId===id\)return/)
 assert.match(ui,/<select disabled=\{busy\}/)
})
test("network failure does not silently erase the editable booking draft",()=>{
 assert.match(ui,/catch\{if\(selectionRef\.current===targetId&&requestRef\.current===requestId\)setFeedback\(t\.error\)\}/)
 assert.doesNotMatch(ui,/catch\{setBooking\(null\);setFeedback\(t\.error\)\}/)
 assert.match(ui,/if\(response\.status===409\)\{setConflict\(true\)/)
})
