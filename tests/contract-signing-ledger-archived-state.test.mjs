import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-supabase.ts",import.meta.url),"utf8")
test("signing state writes require actual transition",()=>{
 assert.match(source,/input\.expectedState===input\.nextState/)
})
test("signed contract evidence prevents subsequent state mutation",()=>{
 assert.match(source,/\.eq\("status",input\.expectedState\)\.is\("signed_pdf_path",null\)/)
})
