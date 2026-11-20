import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const refresh=readFileSync(new URL("../lib/administration/contract-signing-refresh.ts",import.meta.url),"utf8")
const inspect=readFileSync(new URL("../lib/administration/contract-signing-verified-transition.ts",import.meta.url),"utf8")
test("status refresh cannot mutate ledger with user credentials",()=>{
 assert.match(refresh,/getContractSigningStatus\(record\.envelopeId\)/)
 assert.match(refresh,/remote\.id!==record\.envelopeId/)
 assert.doesNotMatch(refresh,/ledger\.transition\(|retryContractSigningSync\(/)
})
test("remote envelope identity is checked before proposing a transition",()=>{
 assert.match(inspect,/remote\.id!==input\.persistedEnvelopeId/)
 assert.match(inspect,/reconcileSigningState\(input\.currentState,remote\.status\)/)
 assert.doesNotMatch(inspect,/\.update\(|\.rpc\(|ledger\.transition\(/)
})
