import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const api=readFileSync("app/api/administration/assistant/route.ts","utf8")
test("AI submitted timesheet total uses an exact count query",()=>{
 assert.match(api,/\.select\("id",\{count:"exact",head:true\}\)\.eq\("status","submitted"\)/)
 assert.match(api,/submittedTimesheetCount\.count==null/)
 assert.match(api,/complete:true/)
 assert.doesNotMatch(api,/timesheets\.data\?\.length/)
})
test("AI context labels live evidence and bounded lists",()=>{
 assert.match(api,/generatedAt:new Date\(\)\.toISOString\(\)/)
 assert.match(api,/All other lists are limited samples/)
 assert.match(api,/Do not treat sampled records as exhaustive/)
 assert.match(api,/You cannot approve, modify, send, pay or sign anything/)
})
