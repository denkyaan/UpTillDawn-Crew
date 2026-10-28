import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
const editor=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking notes API protects immutable communication history and skips no-op writes",()=>{
 assert.match(route,/notes\.split\("\\n"\)\.some\(line=>auditLine\.test\(line\)\)/)
 assert.match(route,/Communication history is immutable/)
 assert.match(route,/unchanged:true/)
 assert.match(route,/booking\.internal_notes!==expectedNotes/)
})
test("booking notes UI rejects stale AI proposals and handles unchanged responses",()=>{
 assert.match(editor,/selectionRef\.current!==targetId/)
 assert.match(editor,/result\.unchanged/)
 assert.match(editor,/notes===editableNotes\(booking\.internal_notes\)/)
 assert.match(editor,/confirmed:true/)
})
