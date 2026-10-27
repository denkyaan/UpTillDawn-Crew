import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-retry.ts",import.meta.url),"utf8")
test("signing sync reloads the ledger before remote reconciliation",()=>{
 assert.match(source,/await ledger\.load\(/)
 assert.match(source,/current\.envelopeId!==record\.envelopeId/)
 assert.match(source,/current\.sourceSha256!==record\.sourceSha256/)
 assert.match(source,/current\.state!==record\.state/)
 assert.match(source,/reconcileSigningState\(current\.state,remote\.status\)/)
})
