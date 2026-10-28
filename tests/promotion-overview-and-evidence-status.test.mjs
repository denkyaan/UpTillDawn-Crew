import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const home=readFileSync("app/(app)/portals/promotion/page.tsx","utf8")
const tasks=readFileSync("app/(app)/portals/promotion/tasks/page.tsx","utf8")
test("promotion overview separates pending from active work and discloses capped totals",()=>{
 assert.match(home,/const notStarted=/)
 assert.match(home,/const inProgress=/)
 assert.match(home,/const open=notStarted\+inProgress/)
 assert.match(home,/countIsPartial/)
 for(const label of ["Nog te starten","À commencer","Not started","Noch nicht begonnen"])assert.ok(home.includes(label))
})
test("promotion evidence history failures are visible in all supported languages",()=>{
 assert.match(tasks,/data:evidence,error:evidenceError/)
 assert.match(tasks,/evidenceError&&<p role="alert"/)
 for(const label of ["Bewijsstatussen konden niet","Les statuts des preuves","Evidence statuses are unavailable","Nachweisstatus nicht verfügbar"])assert.ok(tasks.includes(label))
})
