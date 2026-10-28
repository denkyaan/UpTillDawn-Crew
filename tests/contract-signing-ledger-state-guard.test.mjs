import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-ledger-adapter.ts",import.meta.url),"utf8")
test("signing ledger rejects invalid envelope IDs on every write",()=>{
 assert.match(source,/Invalid envelope attachment/)
 assert.match(source,/Invalid signing envelope/g)
})
test("signing ledger disallows state regressions and terminal transitions",()=>{
 assert.match(source,/draft:\["sent","completed","rejected","cancelled"\]/)
 assert.match(source,/sent:\["completed","rejected","cancelled"\]/)
 assert.match(source,/completed:\[\],rejected:\[\],cancelled:\[\]/)
 assert.match(source,/Invalid signing ledger transition/)
})
