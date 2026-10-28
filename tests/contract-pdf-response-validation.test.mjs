import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const signed=readFileSync(new URL("../lib/administration/contract-signed-retrieve.ts",import.meta.url),"utf8")
const renderer=readFileSync(new URL("../lib/administration/contract-pdf-renderer.ts",import.meta.url),"utf8")
test("signed document download rejects invalid PDF and malformed content length",()=>{
 assert.match(signed,/Number\.isSafeInteger\(size\)/)
 assert.match(signed,/total<5/)
 assert.match(signed,/pdf\.slice\(0,5\)/)
})
test("PDF rendering rejects malformed content length",()=>{
 assert.match(renderer,/Number\.isSafeInteger\(length\)/)
})
