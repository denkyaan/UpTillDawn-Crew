import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking draft requires explicit discard before changing booking",()=>{
 assert.match(ui,/const hasDraft=Boolean\(booking&&notes!==editableNotes\(booking\.internal_notes\)\)/)
 assert.match(ui,/window\.confirm\(t\.leave\)/)
 assert.match(ui,/if\(!mayLeave\(\)\)return/)
 assert.match(ui,/onChange=\{event=>chooseBooking\(event\.target\.value\)\}/)
 assert.match(ui,/if\(mayLeave\(\)\)\{setId\(manualId\);void load\(manualId\)\}/)
 assert.match(ui,/onChange=\{event=>setManualId\(event\.target\.value\)\}/)
})
test("review shows changed-line counts and localized confirmation",()=>{
 assert.match(ui,/addedLines\.length/)
 assert.match(ui,/removedLines\.length/)
 for(const label of ["Niet-opgeslagen wijzigingen verliezen?","Abandonner les modifications","Discard unsaved changes?","Ungespeicherte Änderungen verwerfen?"])assert.ok(ui.includes(label))
 assert.match(ui,/confirmed:true/)
})
