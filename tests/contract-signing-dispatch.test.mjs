import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-dispatch.ts",import.meta.url),"utf8")
test("contract dispatch requires explicit operator confirmation and readiness",()=>{
 assert.match(source,/confirmedByOperator!==true/)
 assert.match(source,/checkContractDispatchReadiness/)
 assert.match(source,/readiness\.ready/)
})
test("contract dispatch checks remote status before distribution and does not retry blindly",()=>{
 assert.ok(source.indexOf("getContractSigningStatus(envelopeId)")<source.indexOf("await distributeContractSigningDraft"))
 assert.match(source,/if\(state!=="draft"\)/)
 assert.match(source,/Invitation sent but ledger update failed/)
})
