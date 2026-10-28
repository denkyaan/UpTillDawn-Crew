import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-supabase.ts",import.meta.url),"utf8")
test("database ledger records are validated before signing reconciliation",()=>{
 assert.match(source,/Invalid signing ledger record/)
 assert.match(source,/Number\.isSafeInteger\(row\.document_version\)/)
 assert.match(source,/row\.document_sha256/)
 assert.match(source,/row\.envelope_id/)
 assert.match(source,/row\.signed_pdf_path/)
 assert.match(source,/signed-\[a-f0-9\]\{64\}\[\.\]pdf/)
})
