import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
const source=readFileSync(new URL("../lib/administration/contract-signing-operator-preflight.ts",import.meta.url),"utf8")
test("operator preflight checks actual approved version and authorization",()=>{
 assert.match(source,/getCurrentUser\(/)
 assert.match(source,/canOpenPortal\("administration"/)
 assert.match(source,/\.eq\("booking_id",input\.bookingId\)/)
 assert.match(source,/version\.approved_at/)
})
test("preflight is fail-closed and cannot dispatch invitations",()=>{
 assert.match(source,/ready:false/)
 assert.match(source,/archive_verification_required/)
 assert.match(source,/dispatch_disabled/)
 assert.doesNotMatch(source,/distributeContractSigningDraft|dispatchApprovedSigningEnvelope|\bfetch\(/)
})
