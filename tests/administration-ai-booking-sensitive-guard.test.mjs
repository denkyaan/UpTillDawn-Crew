import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const route=readFileSync("app/api/administration/assistant/booking-notes/propose/route.ts","utf8")
test("AI note proposals reject sensitive financial, legal and identity instructions before model execution",()=>{
 assert.match(route,/const sensitiveRequest=/)
 assert.match(route,/sensitiveRequest\.test\(parsed\.data\.instruction\)/)
 assert.match(route,/status:422/)
 assert.ok(route.indexOf("sensitiveRequest.test(parsed.data.instruction)")<route.indexOf("ai.run("))
})
test("AI note proposals reject newly introduced sensitive identifiers and audit lines",()=>{
 assert.match(route,/const sensitiveOutput=/)
 assert.match(route,/sensitiveOutput\.test\(proposal\.data\.notes\)/)
 assert.match(route,/!sensitiveOutput\.test\(current\)/)
 assert.match(route,/auditLine\.test\(line\)/)
 assert.match(route,/status:502/)
})
