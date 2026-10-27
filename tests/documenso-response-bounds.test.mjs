import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/documenso-envelope.ts",import.meta.url),"utf8")
test("Documenso JSON responses must be content typed and bounded",()=>{
 assert.match(source,/application\/json/)
 assert.match(source,/Number\.isSafeInteger\(size\)/)
 assert.match(source,/total>65536/)
 assert.match(source,/reader\.cancel\(\)/)
 assert.match(source,/TextDecoder\("utf-8",\{fatal:true\}\)/)
})
test("remote envelope identity and status are verified",()=>{
 assert.match(source,/data\.id!==id/)
 assert.match(source,/Invalid Documenso status/)
})
