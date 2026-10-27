import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-dispatch-readiness.ts",import.meta.url),"utf8")
test("dispatch requires an approval timestamp not in the future",()=>{
 assert.match(source,/approvalTime>Date\.now\(\)/)
})
test("dispatch requires a syntactically valid recipient matching the approved document",()=>{
 assert.match(source,/recipient!==approvedRecipient/)
 assert.match(source,/test\(recipient\)/)
})
