import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking note preview uses occurrence-aware line differences",()=>{
 assert.match(ui,/const remaining=new Map<string,number>\(\)/)
 assert.match(ui,/remaining\.set\(line,\(remaining\.get\(line\)\?\?0\)\+1\)/)
 assert.match(ui,/remaining\.set\(line,count-1\)/)
 assert.match(ui,/const addedLines=lineChanges\(originalLines,draftLines\)/)
 assert.match(ui,/const removedLines=lineChanges\(draftLines,originalLines\)/)
 assert.match(ui,/editableNotes\(booking\.internal_notes\)\|\|"—"/)
})
test("booking search uses captured query and request identity for pagination",()=>{
 assert.match(ui,/const listRequestRef=useRef\(0\)/)
 assert.match(ui,/const listRequestId=\+\+listRequestRef\.current/)
 assert.match(ui,/const query=search\.trim\(\)/)
 assert.match(ui,/encodeURIComponent\(query\)/)
 assert.match(ui,/if\(listRequestId!==listRequestRef\.current\)return/)
})
