import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const state=readFileSync(new URL("../lib/administration/contract-signing-status.ts",import.meta.url),"utf8")
const recovery=readFileSync(new URL("../lib/administration/contract-signing-recovery-server.ts",import.meta.url),"utf8")
test("signing-state polling verifies remote envelope identity",()=>{
 assert.match(state,/remote\.id!==input\.envelopeId/)
})
test("signed archive recovery refuses unverified remote completion",()=>{
 assert.match(recovery,/getContractSigningStatus\(record\.envelopeId\)/)
 assert.match(recovery,/remote\.id!==record\.envelopeId\|\|remote\.status!=="COMPLETED"/)
})
