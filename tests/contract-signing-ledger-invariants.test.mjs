import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-supabase.ts",import.meta.url),"utf8")
test("persisted non-draft signing state must have a remote envelope",()=>{
 assert.match(source,/row\.status!=="draft"&&row\.envelope_id===null/)
})
test("signed archive path is only valid for a completed envelope",()=>{
 assert.match(source,/row\.signed_pdf_path!==null&&\(row\.status!=="completed"\|\|row\.envelope_id===null\)/)
})
