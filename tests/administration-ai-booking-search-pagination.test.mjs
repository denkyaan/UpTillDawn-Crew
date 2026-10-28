import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/booking-notes/route.ts","utf8")
const ui=readFileSync("components/administration/administration-ai-booking-notes.tsx","utf8")
test("artist search is bounded, excludes cancelled bookings and uses deterministic paging",()=>{
 assert.match(route,/search\.length>80/)
 assert.match(route,/Number\.isSafeInteger\(page\)/)
 assert.match(route,/page>1000/)
 assert.match(route,/\.neq\("status","cancelled"\)/)
 assert.match(route,/\.order\("artist_name",\{ascending:true\}\)\.order\("id",\{ascending:true\}\)/)
 assert.match(route,/\.slice\(0,pageSize\)/)
})
test("selector exposes localized search and bounded next/previous navigation",()=>{
 assert.match(ui,/encodeURIComponent\(search\.trim\(\)\)/)
 assert.match(ui,/void listBookings\(page-1\)/)
 assert.match(ui,/void listBookings\(page\+1\)/)
 assert.match(ui,/setHasMore\(Boolean\(payload\.hasMore\)\)/)
 for(const locale of ["Zoek artiest","Rechercher un artiste","Search artist","Künstler suchen"])assert.ok(ui.includes(locale))
})
