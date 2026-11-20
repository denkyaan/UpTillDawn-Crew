import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {normalizeShiftDeclineReason} from "../src/shared/shift-response.ts"
import {copy,languages} from "../src/shared/i18n.ts"

test("shift decline reason is bounded, normalized and rejects control characters",()=>{
 assert.equal(normalizeShiftDeclineReason("  Family emergency  "),"Family emergency")
 assert.equal(normalizeShiftDeclineReason("  A valid reason\nSecond line  "),"A valid reason\nSecond line")
 for(const invalid of [""," ","a","aa","z".repeat(501),"abc\u0000def","abc\u007f",null,[],123]){
  assert.throws(()=>normalizeShiftDeclineReason(invalid),/invalid_shift_decline_reason/)
 }
 assert.equal(normalizeShiftDeclineReason("a".repeat(500)).length,500)
})
test("shift declines only use audited authenticated existing RPC, never direct table mutation",()=>{
 const source=readFileSync(new URL("../src/lib/operational-mutations.ts",import.meta.url),"utf8")
 const crew=readFileSync(new URL("../src/screens/crew.tsx",import.meta.url),"utf8")
 assert.ok(source.includes("export async function declineOwnShift("))
 assert.ok(source.includes("requireUuid(id)"))
 assert.ok(source.includes("await verifyOwnSession()"))
 assert.ok(source.includes('rpc("upt_respond_shift"'))
 assert.ok(source.includes('p_response:"declined"'))
 assert.ok(!source.includes('.from("shifts").update('))
 assert.ok(crew.includes("writesAvailable()&&shift.status"))
 assert.ok(crew.includes("await declineOwnShift(id,declineReason)"))
 assert.ok(crew.includes("r.refresh()"))
})
test("shift response texts exist in all four user locales",()=>{
 assert.deepEqual([...languages],["nl","fr","en","de"])
 for(const language of languages){
  const t=copy(language)
  for(const key of ["confirmShift","declineShift","declineReason","confirmDecline","cancelDecline","shiftUpdateFailed"])
   assert.ok(typeof t[key]==="string"&&t[key].length>2)
 }
})
