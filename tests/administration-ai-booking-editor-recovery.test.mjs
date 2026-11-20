import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("booking reload does not discard draft before the server confirms a replacement",()=>{
 assert.match(ui,/setBusy\(true\);setFeedback\(""\)\n  try\{\n   const response=await fetch\("\/api\/administration\/assistant\/booking-notes\?bookingId="/)
 assert.match(ui,/setBooking\(payload\.booking\)/)
 assert.match(ui,/setConflict\(false\);setSavedRefreshPending\(false\)/)
 assert.match(ui,/if\(mayLeave\(\)\)void load\(booking\.id\)/)
})
test("AI editor reports sensitive request rejection and permits retrying post-save refresh",()=>{
 assert.match(ui,/if\(response\.status===422\)\{setFeedback\(t\.sensitive\);return\}/)
 assert.match(ui,/setSavedRefreshPending\(true\)/)
 assert.match(ui,/savedRefreshPending&&<button/)
 for(const text of ["Gevoelige gegevens","Les données ou instructions sensibles","Sensitive data or instructions","Sensible Daten oder Anweisungen"])assert.ok(ui.includes(text))
})
